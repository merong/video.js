<?php
// TASK L-1-SPIKE item 8: record what a pagehide report delivered. One JSON line per request in evidence/beacon-log.jsonl.

$body = file_get_contents('php://input') ?: '';
$line = [
    'receivedAt' => date('c'),
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'kind' => $_GET['kind'] ?? '',
    'browser' => $_GET['browser'] ?? '',
    'run' => $_GET['run'] ?? '',
    'contentType' => $_SERVER['CONTENT_TYPE'] ?? '',
    'secFetchMode' => $_SERVER['HTTP_SEC_FETCH_MODE'] ?? '',
    'origin' => $_SERVER['HTTP_ORIGIN'] ?? '',
    'json' => json_decode($body, true) !== null,
    'body' => substr($body, 0, 500),
];

file_put_contents(__DIR__ . '/evidence/beacon-log.jsonl', json_encode($line, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
http_response_code(204);
