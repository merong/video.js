<?php
declare(strict_types=1);

namespace AdsManager;

abstract class Host
{
    public function __construct(protected readonly Database $db, protected readonly array $config) {}

    abstract public function authenticated(): bool;
    abstract public function csrfToken(): string;
    abstract public function verifyCsrf(mixed $token): void;
    abstract public function resolveVideoContext(string $videoId): array;
    abstract public function capabilities(): array;
    abstract public function targets(string $type, string $query, ?string $boardId): array;

    public function requireAdmin(bool $write = false): void
    {
        if (!$this->authenticated()) {
            throw new ApiError(401, 'login_required', '관리자 로그인이 필요합니다.');
        }
    }

    public function validateTarget(array $target): void {}

    public function login(array $input): array
    {
        throw new ApiError(403, 'host_login', '호스트 사이트에서 로그인해 주세요.');
    }

    public function logout(): array
    {
        throw new ApiError(403, 'host_login', '호스트 사이트에서 로그아웃해 주세요.');
    }

    public function saveVideoContext(array $input): array
    {
        throw new ApiError(403, 'host_context', '호스트가 영상 정보를 관리합니다.');
    }
}
