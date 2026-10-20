<?php
declare(strict_types=1);

namespace AdsManager;

/** Bounded static-media transport for the PHP development router. */
final class MediaResponse
{
    public static function send(string $path, string $mime, string $cacheControl): void
    {
        $file = fopen($path, 'rb');
        if ($file === false) {
            throw new ApiError(500, 'media_unavailable', '미디어 파일을 읽을 수 없습니다.');
        }

        try {
            $stat = fstat($file);
            if (!$stat || !is_int($stat['size']) || $stat['size'] < 0) {
                throw new ApiError(500, 'media_unavailable', '미디어 파일을 읽을 수 없습니다.');
            }
            $size = $stat['size'];
            $modified = gmdate('D, d M Y H:i:s', $stat['mtime']) . ' GMT';
            $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
            header('X-Content-Type-Options: nosniff');
            header('Content-Type: ' . $mime);
            header('Cache-Control: ' . $cacheControl);
            header('Accept-Ranges: bytes');
            header('Last-Modified: ' . $modified);

            if (!in_array($method, ['GET', 'HEAD'], true)) {
                http_response_code(405);
                header('Allow: GET, HEAD');
                header('Content-Length: 0');
                return;
            }

            $start = 0;
            $end = $size - 1;
            $status = 200;
            $range = trim($_SERVER['HTTP_RANGE'] ?? '');
            $ifRange = trim($_SERVER['HTTP_IF_RANGE'] ?? '');
            // No strong ETag is emitted. An unrecognized/stale If-Range validator
            // must return the whole representation instead of an unrelated slice.
            if ($ifRange !== '' && $ifRange !== $modified) {
                $range = '';
            }
            // HEAD ignores Range; unknown range units are ignored as well.
            if ($method === 'GET' && preg_match('/^bytes\s*=/i', $range)) {
                $bounds = self::range($range, $size);
                if ($bounds === null) {
                    http_response_code(416);
                    header('Content-Range: bytes */' . $size);
                    header('Content-Length: 0');
                    return;
                }
                [$start, $end] = $bounds;
                $status = 206;
            }

            $length = $end - $start + 1;
            if ($length > 0 && fseek($file, $start, SEEK_SET) !== 0) {
                throw new ApiError(500, 'media_unavailable', '미디어 파일을 읽을 수 없습니다.');
            }
            http_response_code($status);
            header('Content-Length: ' . $length);
            if ($status === 206) {
                header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
            }
            if ($method === 'HEAD') {
                return;
            }

            // Do not buffer a whole video or read past the requested interval.
            $remaining = $length;
            while ($remaining > 0 && !connection_aborted()) {
                $chunk = fread($file, min(65536, $remaining));
                if ($chunk === false || $chunk === '') {
                    break;
                }
                echo $chunk;
                $remaining -= strlen($chunk);
            }
        } finally {
            fclose($file);
        }
    }

    /** Supports exactly one closed, open-ended or suffix byte range. */
    private static function range(string $header, int $size): ?array
    {
        if ($size === 0 || strlen($header) > 512 || !preg_match('/^bytes\s*=\s*(\d*)-(\d*)$/iD', $header, $match) || ($match[1] === '' && $match[2] === '')) {
            return null;
        }
        if ($match[1] === '') {
            $suffix = self::boundedInteger($match[2], $size);
            return $suffix === 0 ? null : [$size - $suffix, $size - 1];
        }

        $start = self::boundedInteger($match[1], $size);
        $end = $match[2] === '' ? $size - 1 : self::boundedInteger($match[2], $size - 1);
        return $start >= $size || $end < $start ? null : [$start, $end];
    }

    /** Clamp decimal input before casting, including values beyond PHP_INT_MAX. */
    private static function boundedInteger(string $digits, int $maximum): int
    {
        $digits = ltrim($digits, '0');
        $bound = (string) $maximum;
        if (strlen($digits) > strlen($bound) || (strlen($digits) === strlen($bound) && strcmp($digits, $bound) > 0)) {
            return $maximum;
        }
        return $digits === '' ? 0 : (int) $digits;
    }
}
