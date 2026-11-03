<?php
declare(strict_types=1);

namespace AdsManager;

/** Player logo images: the built-in sample first, then uploads kept as one document in the meta table. */
final class Logos
{
    public const LIMIT = 50;
    public const BYTES = 1048576;
    private const KEY = 'player_logos';
    public const MIMES = ['image/png' => 'png', 'image/svg+xml' => 'svg', 'image/gif' => 'gif', 'image/webp' => 'webp', 'image/jpeg' => 'jpg'];
    // What finfo may call an SVG file; the extension and the XML root decide.
    private const SVG_SNIFFED = ['image/svg+xml', 'image/svg', 'text/xml', 'application/xml', 'text/plain', 'text/html'];
    private const SVG_NS = 'http://www.w3.org/2000/svg';
    private const SVG_ELEMENTS = ['script', 'foreignobject', 'iframe', 'embed', 'object', 'handler', 'listener'];

    public function __construct(private readonly Database $db, private readonly array $config, private readonly PlayerPresets $presets) {}

    public function list(): array
    {
        $used = $this->presets->logoIds();
        $sample = ['logoId' => 'sample', 'name' => '샘플 로고', 'url' => $this->sampleUrl(), 'mime' => 'image/svg+xml', 'bytes' => null, 'width' => null, 'height' => null, 'builtIn' => true, 'inUse' => in_array('sample', $used, true), 'createdAt' => null];
        $items = array_map(fn (array $logo): array => $this->item($logo, $used), self::stored($this->db));
        return ['items' => [$sample, ...$items], 'limits' => ['bytes' => $this->limit(), 'count' => self::LIMIT, 'mimes' => array_keys(self::MIMES)]];
    }

    public function upload(array $input, array $file): array
    {
        $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new ApiError(413, 'upload_size', '로고는 ' . self::megabytes($this->limit()) . '까지 올릴 수 있어요.');
        }
        if ($error !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
            Value::fail('file', '올릴 로고 파일을 골라 주세요.');
        }
        return $this->store($input, $file['tmp_name'], is_string($file['name'] ?? null) ? $file['name'] : '', move_uploaded_file(...));
    }

    /** Checks and keeps one image; `$move` puts the temporary file in place (move_uploaded_file for requests). */
    public function store(array $input, string $tmp, string $originalName, callable $move): array
    {
        $size = filesize($tmp);
        if ($size === false || $size < 1) {
            Value::fail('file', '올릴 로고 파일을 골라 주세요.');
        }
        if ($size > $this->limit()) {
            throw new ApiError(413, 'upload_size', '로고는 ' . self::megabytes($this->limit()) . '까지 올릴 수 있어요.');
        }
        $image = self::inspect($tmp, $originalName);
        $name = self::name($input['name'] ?? null, $originalName);

        return $this->db->write(function () use ($tmp, $size, $image, $name, $move): array {
            $logos = self::stored($this->db);
            if (count($logos) >= self::LIMIT) {
                throw new ApiError(400, 'logo_limit', '로고는 ' . self::LIMIT . '개까지 보관할 수 있어요. 쓰지 않는 로고를 지워 주세요.');
            }
            $id = Value::uuid();
            $file = $id . '.' . self::MIMES[$image['mime']];
            $path = Creatives::storageRoot($this->config['uploadRoot']) . '/' . $file;
            if (file_exists($path) || is_link($path) || !$move($tmp, $path)) {
                throw new ApiError(500, 'upload_failed', '파일 저장에 실패했습니다.');
            }
            chmod($path, 0644);
            try {
                $logos[] = $logo = ['logoId' => $id, 'name' => $name, 'file' => $file, 'mime' => $image['mime'], 'bytes' => $size, 'width' => $image['width'], 'height' => $image['height'], 'createdAt' => Value::now()];
                $this->save($logos);
            } catch (\Throwable $error) {
                unlink($path);
                throw $error;
            }
            return ['logo' => $this->item($logo, $this->presets->logoIds())];
        }) + $this->list();
    }

    public function delete(array $input): array
    {
        $id = $input['logoId'] ?? null;
        if ($id === 'sample') {
            throw new ApiError(400, 'logo_builtin', '샘플 로고는 지울 수 없어요.');
        }
        if (!is_string($id) || !preg_match('/^[0-9a-f]{32}$/D', $id)) {
            Value::fail('logoId');
        }

        $file = $this->db->write(function () use ($id): string {
            $logos = self::stored($this->db);
            $index = array_search($id, array_column($logos, 'logoId'), true);
            if ($index === false) {
                throw new ApiError(404, 'logo_not_found', '로고를 찾을 수 없어요. 다시 불러와 주세요.');
            }
            if (in_array($id, $this->presets->logoIds(), true)) {
                throw new ApiError(409, 'logo_in_use', '플레이어 설정에서 쓰고 있는 로고는 지울 수 없어요. 다른 로고로 바꾼 뒤 지워 주세요.');
            }
            $file = $logos[$index]['file'];
            array_splice($logos, $index, 1);
            $this->save($logos);
            return $file;
        });
        // After the commit: a failed unlink leaves an unlisted file, never a listed logo without its file.
        $path = Creatives::storageRoot($this->config['uploadRoot']) . '/' . $file;
        if (is_file($path) && !is_link($path)) {
            unlink($path);
        }
        return $this->list();
    }

    /** Uploaded logos as stored, oldest first. */
    public static function stored(Database $db): array
    {
        $stored = $db->meta(self::KEY);
        return $stored === null ? [] : Value::decode($stored)['items'];
    }

    /** The public URL of an uploaded logo, or null when the id is not in the library. */
    public static function url(Database $db, array $config, string $id): ?string
    {
        foreach (self::stored($db) as $logo) {
            if ($logo['logoId'] === $id) {
                return rtrim($config['uploadUrl'], '/') . '/' . $logo['file'];
            }
        }
        return null;
    }

    /**
     * The image type and size of a logo file, or a validation failure. Raster images need a size; an SVG must be
     * an SVG root without scripts, event attributes, foreign content or references outside the document.
     */
    public static function inspect(string $path, string $originalName): array
    {
        $sniffed = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) === 'svg' && in_array($sniffed, self::SVG_SNIFFED, true)) {
            return ['mime' => 'image/svg+xml', ...self::svg((string) file_get_contents($path))];
        }
        if (!isset(self::MIMES[$sniffed]) || $sniffed === 'image/svg+xml') {
            Value::fail('file', '투명 배경 PNG, SVG, GIF, WebP, JPEG 파일만 올릴 수 있어요.');
        }
        $size = @getimagesize($path);
        if (!$size || $size[0] < 1 || $size[1] < 1) {
            Value::fail('file', '이미지 크기를 읽을 수 없어요. 다른 파일로 올려 주세요.');
        }
        return ['mime' => $sniffed, 'width' => $size[0], 'height' => $size[1]];
    }

    private static function svg(string $xml): array
    {
        $unsafe = static fn () => Value::fail('file', 'SVG에 스크립트나 외부 주소가 들어 있어 올릴 수 없어요. 그림만 있는 SVG로 저장해 주세요.');
        // DTDs (entities) and processing instructions such as xml-stylesheet are refused before parsing.
        if (preg_match('/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)/i', $xml)) {
            $unsafe();
        }
        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($xml, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $root = $document->documentElement;
        if (!$loaded || !$root || $root->localName !== 'svg' || $root->namespaceURI !== self::SVG_NS) {
            Value::fail('file', 'SVG 파일을 읽을 수 없어요. 다른 파일로 올려 주세요.');
        }

        foreach ($document->getElementsByTagName('*') as $element) {
            $tag = strtolower($element->localName);
            if (in_array($tag, self::SVG_ELEMENTS, true)) {
                $unsafe();
            }
            if (in_array($tag, ['set', 'animate'], true) && in_array(strtolower(preg_replace('/^.*:/', '', $element->getAttribute('attributeName'))), ['href'], true)) {
                $unsafe();
            }
            if ($tag === 'style' && self::unsafeCss($element->textContent)) {
                $unsafe();
            }
            foreach ($element->attributes as $attribute) {
                $name = strtolower($attribute->localName);
                $value = trim($attribute->value);
                if (str_starts_with($name, 'on') || preg_match('/javascript:/i', $value) || self::unsafeCss($value)) {
                    $unsafe();
                }
                if ($name === 'href' && !str_starts_with($value, '#') && !preg_match('#^data:image/(png|jpeg|gif|webp)[;,]#i', $value)) {
                    $unsafe();
                }
            }
        }

        $length = static fn (string $value): ?int => preg_match('/^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/D', $value, $match) && (float) $match[1] > 0 ? (int) round((float) $match[1]) : null;
        $width = $length($root->getAttribute('width'));
        $height = $length($root->getAttribute('height'));
        $box = preg_split('/[\s,]+/', trim($root->getAttribute('viewBox')));
        if (($width === null || $height === null) && count($box) === 4 && is_numeric($box[2]) && is_numeric($box[3]) && $box[2] > 0 && $box[3] > 0) {
            [$width, $height] = [(int) round((float) $box[2]), (int) round((float) $box[3])];
        }
        return ['width' => $width, 'height' => $height];
    }

    /** CSS that loads anything: @import, or url() that is not a same-document #fragment. */
    private static function unsafeCss(string $css): bool
    {
        return (bool) preg_match('/@import|url\(\s*(?![\'"]?\s*#)/i', $css);
    }

    private static function name(mixed $value, string $originalName): string
    {
        if ($value !== null && $value !== '') {
            return trim(Value::text($value, 'name', 80));
        }
        $name = trim(preg_replace('/[\x00-\x1f\x7f]/u', '', (string) pathinfo($originalName, PATHINFO_FILENAME)) ?? '');
        return $name === '' ? '로고' : mb_substr($name, 0, 80);
    }

    private function item(array $logo, array $used): array
    {
        return [
            'logoId' => $logo['logoId'], 'name' => $logo['name'], 'url' => rtrim($this->config['uploadUrl'], '/') . '/' . $logo['file'],
            'mime' => $logo['mime'], 'bytes' => $logo['bytes'], 'width' => $logo['width'], 'height' => $logo['height'],
            'builtIn' => false, 'inUse' => in_array($logo['logoId'], $used, true), 'createdAt' => $logo['createdAt'],
        ];
    }

    private function save(array $logos): void
    {
        $exists = $this->db->meta(self::KEY) !== null;
        $sql = $exists ? 'UPDATE ' . $this->db->table('meta') . ' SET value = ? WHERE name = ?' : 'INSERT INTO ' . $this->db->table('meta') . ' (value, name) VALUES (?, ?)';
        $this->db->run($sql, [Value::json(['items' => $logos]), self::KEY]);
    }

    private function limit(): int
    {
        return min(self::BYTES, Creatives::uploadLimit($this->config));
    }

    /** The sample image beside the player module, or under the manager's /player/ beside /api/. */
    private function sampleUrl(): string
    {
        $module = $this->config['playerModuleUrl'];
        $base = $module !== null ? substr($module, 0, strrpos($module, '/') + 1) : rtrim(dirname($this->config['apiUrl'], 2), '/') . '/player/';
        return $base . PlayerPresets::LOGO_ASSETS['sample'];
    }

    private static function megabytes(int $bytes): string
    {
        return $bytes >= 1048576 ? round($bytes / 1048576, 1) . 'MB' : (int) ceil($bytes / 1024) . 'KB';
    }
}
