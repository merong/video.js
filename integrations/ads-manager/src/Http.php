<?php
declare(strict_types=1);

namespace AdsManager;

final class Http
{
    public static function sameOrigin(): void
    {
        if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
            throw new ApiError(403, 'origin', '같은 사이트에서 요청해 주세요.');
        }
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
            $expected = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '');
            if (strtolower(rtrim($_SERVER['HTTP_ORIGIN'], '/')) !== strtolower($expected)) {
                throw new ApiError(403, 'origin', '같은 사이트에서 요청해 주세요.');
            }
        }
    }

    public static function input(string $method, string $action, array $config): array
    {
        if ($method === 'GET') {
            return $_GET;
        }
        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($action === 'creative-upload') {
            if ($length > Creatives::uploadLimit($config) + 16384 || ($length > 0 && $_POST === [] && $_FILES === [])) {
                throw new ApiError(413, 'upload_size', '업로드 제한을 초과했습니다.');
            }
            return $_POST;
        }
        if ($length > 1048576) {
            throw new ApiError(413, 'payload_size', '요청 크기 제한을 초과했습니다.');
        }
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
            throw new ApiError(400, 'content_type', 'JSON 요청이 필요합니다.');
        }
        $body = file_get_contents('php://input', false, null, 0, 1048577);
        if (strlen($body) > 1048576) {
            throw new ApiError(413, 'payload_size', '요청 크기 제한을 초과했습니다.');
        }
        try {
            return Value::decode($body);
        } catch (\JsonException $error) {
            throw new ApiError(400, 'invalid_json', 'JSON 요청을 확인해 주세요.');
        }
    }

    public static function error(\Throwable $error): void
    {
        if ($error instanceof ApiError) {
            http_response_code($error->status);
            $details = ['code' => $error->errorCode, 'message' => $error->getMessage()];
            if ($error->fields !== []) {
                $details['fields'] = $error->fields;
            }
        } else {
            http_response_code(500);
            $details = ['code' => 'server_error', 'message' => '요청을 처리하지 못했습니다. 설치 설정을 확인해 주세요.'];
        }
        header('Content-Type: application/json; charset=utf-8');
        echo Value::json(['ok' => false, 'error' => $details]);
    }

    public static function csrfHeader(?App $app, string $action): void
    {
        if (!$app || in_array($action, ['schedule', 'events'], true)) {
            return;
        }
        // GnuBoard consumes its native token even when a later input validation fails.
        // Refresh on errors too; the UI reads this header before handling the status.
        try {
            if ($app->host->authenticated()) {
                header('X-CSRF-Token: ' . $app->host->csrfToken());
            }
        } catch (\Throwable $error) {
            // Do not replace an existing response error with host bootstrap details.
        }
    }
}
