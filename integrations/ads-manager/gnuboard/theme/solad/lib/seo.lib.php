<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

/*
 * 검색·공유용 머리 태그와 구조화 데이터(JSON-LD). head.sub.php가 <title> 바로 뒤에서 solad_seo_head()를 부른다.
 * 설명 문구는 사이트 화면에 이미 있는 문구만 쓴다. theme-color와 viewport는 theme.config.php가 넣는다.
 * 구매 안내 FAQ는 화면(skin/content/solad/content.skin.php)과 FAQPage가 solad_seo_faq() 한 배열을 같이 쓴다.
 */

define('SOLAD_SEO_SITE_NAME', '솔애드');
define('SOLAD_SEO_EMAIL', 'info@oootool.com');
define('SOLAD_SEO_DESCRIPTION', '광고를 붙일 수 있는 솔애드 플레이어와 그누보드5로 꾸린 동영상 예제 사이트예요. 영상과 광고는 모두 관리자 화면에서 바꿀 수 있어요.');

// 상단 주소(scheme://host[:port])를 붙여 절대 주소로 만든다. 그누보드가 HTML용으로 넣은 &amp;는 되돌린다.
function solad_seo_url($url)
{
    $url = html_entity_decode((string) $url, ENT_QUOTES, 'UTF-8');
    if ($url === '' || preg_match('#^https?://#i', $url)) {
        return $url;
    }
    if (strpos($url, '//') === 0) {
        return (string) parse_url(G5_URL, PHP_URL_SCHEME).':'.$url;
    }
    if ($url[0] === '/') {
        return preg_replace('#^(https?://[^/]+).*$#i', '$1', G5_URL).$url;
    }
    return rtrim(G5_URL, '/').'/'.$url;
}

function solad_seo_brand($file)
{
    return G5_THEME_URL.'/img/brand/'.$file;
}

// HTML 본문이나 이스케이프된 제목을 메타·JSON에 넣을 평문으로 바꾼다.
function solad_seo_text($html, $length = 0)
{
    $text = str_replace(array('<br>', '<br/>', '<br />', '</p>', '</li>', '</h2>', '</h3>'), ' ', (string) $html);
    $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($text), ENT_QUOTES, 'UTF-8')));
    return $length ? cut_str($text, $length, '…') : $text;
}

function solad_seo_attr($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function solad_seo_is_secret($write)
{
    return isset($write['wr_option']) && strpos($write['wr_option'], 'secret') !== false;
}

// 구매 안내 FAQ. 답은 특징·구매 안내 페이지에 있는 사실만 옮겼다.
function solad_seo_faq()
{
    return array(
        array(
            'q' => '솔애드는 무엇인가요?',
            'a' => '솔애드는 동영상 플레이어와 광고 관리 화면을 함께 쓰는 상품이에요. 관리 화면에서 정한 광고와 플레이어 모양이 게시판 영상에 그대로 적용돼요.',
        ),
        array(
            'q' => '어떤 사이트에서 쓸 수 있나요?',
            'a' => '그누보드5(영카트 포함) 사이트는 그누보드용을, 강의·교육 사이트는 LMS용을 골라 주세요. LMS용은 그누보드 없이 따로 설치하고 외부 LMS와 연결해요.',
        ),
        array(
            'q' => '어떤 영상 형식을 재생하나요?',
            'a' => 'MP4·WebM 파일을 올리거나 영상 주소를 넣어요. HLS는 묶음(zip)으로 올리거나 외부 .m3u8 주소를 넣으면 돼요.',
        ),
        array(
            'q' => '어떤 광고를 넣을 수 있고, 건너뛸 수 있나요?',
            'a' => '본편 앞(프리롤), 정한 시점의 중간(미드롤), 본편이 끝난 뒤(포스트롤)에 MP4·WebM 영상 광고와 JPG·PNG·GIF·WebP 이미지 광고를 넣어요. 광고마다 몇 초 뒤에 건너뛸 수 있게 할지 정해요.',
        ),
        array(
            'q' => '가격은 얼마인가요?',
            'a' => '그누보드용과 LMS용 모두 가격은 별도 협의예요. 지금은 베타 테스트 중이라 구매와 설치는 메일('.SOLAD_SEO_EMAIL.')로 먼저 상의해 주세요.',
        ),
        array(
            'q' => '설치하려면 어떤 서버 환경이 필요한가요?',
            'a' => 'PHP 8.2 이상과 PDO(pdo_mysql), fileinfo, mbstring, MySQL/MariaDB 데이터베이스(InnoDB, utf8mb4), PHP가 쓸 수 있는 비공개 업로드 폴더가 필요해요. 진행 바 미리보기 썸네일 같은 부가 기능은 서버에서 ffmpeg를 실행할 수 있어야 써요.',
        ),
        array(
            'q' => '사이트에 맞춘 기능을 따로 만들 수 있나요?',
            'a' => '커스텀 플레이어 제작으로 AI 연동, 자막 자동 생성 및 다국어 번역 자막처럼 사이트에 필요한 플레이어 기능을 따로 만들어 드려요. 비용은 상품 가격과 별도로 견적을 드려요. 두 예시는 주문을 받아 만드는 기능이고, 지금 솔애드에 들어 있는 기능은 아니에요.',
        ),
    );
}

// 영상 글의 대표 그림: 만든 커버, 첨부 이미지, 그누보드 썸네일 순서로 찾는다.
function solad_seo_video_image($board, $write)
{
    if (!solad_theme_video_lib($board)) {
        return '';
    }
    $bo_table = $board['bo_table'];
    $wr_id = (int) $write['wr_id'];

    $media = solad_video_media_files($bo_table, $wr_id);
    if (!empty($media['cover'])) {
        return $media['cover'];
    }

    $image = solad_video_pick_file(get_file($bo_table, $wr_id), SOLAD_IMAGE_EXTENSIONS);
    if ($image) {
        return solad_video_file_url($image);
    }

    include_once(G5_LIB_PATH.'/thumbnail.lib.php');
    $thumb = get_list_thumbnail($bo_table, $wr_id, $board['bo_gallery_width'], $board['bo_gallery_height'], false, true);
    return empty($thumb['src']) ? '' : $thumb['src'];
}

// 초 단위 재생 시간을 ISO 8601 기간(PT1H2M3S)으로 바꾼다.
function solad_seo_duration($seconds)
{
    $seconds = (int) round((float) $seconds);
    if ($seconds <= 0) {
        return '';
    }
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return 'PT'.($h ? $h.'H' : '').($m ? $m.'M' : '').($s ? $s.'S' : '');
}

function solad_seo_date($datetime)
{
    try {
        $date = new DateTime($datetime, new DateTimeZone('Asia/Seoul'));
    } catch (Exception $e) {
        return '';
    }
    return $date->format('c');
}

function solad_seo_breadcrumb($items)
{
    $list = array();
    foreach ($items as $i => $item) {
        $list[] = array('@type' => 'ListItem', 'position' => $i + 1, 'name' => $item[0], 'item' => $item[1]);
    }
    return array('@type' => 'BreadcrumbList', 'itemListElement' => $list);
}

// 지금 화면의 메타 값과 페이지별 구조화 데이터를 정한다. 기본은 색인하지 않고, 홈·내용 페이지·게시판만 색인한다.
function solad_seo_page()
{
    global $g5, $bo_table, $wr_id, $write, $board, $co, $co_id, $stx, $sca, $page;

    $home = rtrim(G5_URL, '/').'/';
    $title = solad_seo_text(isset($g5['title']) ? $g5['title'] : '');
    $seo = array(
        'title' => $title !== '' ? $title : SOLAD_SEO_SITE_NAME,
        'description' => SOLAD_SEO_DESCRIPTION,
        'canonical' => '',
        'image' => '',
        'og_type' => 'website',
        'noindex' => true,
        'graph' => array(),
    );
    $script = basename(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '');

    if (defined('_INDEX_')) {
        $seo['description'] = '그누보드 동영상 게시판에 바로 붙여 쓰는 솔애드 플레이어예요. 관리자 화면에서 정한 광고·로고·테마가 게시판 영상에 그대로 적용돼요.';
        $seo['canonical'] = $home;
        $seo['noindex'] = false;
        return $seo;
    }

    if ($script === 'content.php' && !empty($co['co_id'])) {
        $url = solad_seo_url(get_pretty_url('content', $co['co_id']));
        $descriptions = array(
            'features' => '솔애드 플레이어는 그누보드 동영상 게시판에 붙여 쓰는 동영상 플레이어예요. 관리 화면에서 정한 광고와 플레이어 모양이 게시판 영상에 그대로 적용돼요.',
            'purchase' => '솔애드는 동영상 플레이어와 광고 관리 화면을 함께 쓰는 상품이에요. 쓰시는 사이트에 맞춰 그누보드용과 LMS용 중에서 골라 주세요.',
        );
        if (isset($descriptions[$co['co_id']])) {
            $seo['description'] = $descriptions[$co['co_id']];
        }
        $seo['canonical'] = $url;
        $seo['noindex'] = false;
        $seo['graph'][] = solad_seo_breadcrumb(array(array(SOLAD_SEO_SITE_NAME, $home), array($seo['title'], $url)));
        if ($co['co_id'] === 'purchase') {
            $seo['graph'] = array_merge($seo['graph'], solad_seo_purchase_graph($url));
        }
        return $seo;
    }

    if ($script !== 'board.php' || empty($board['bo_table'])) {
        return $seo;
    }

    $board_title = solad_seo_text($board['bo_subject']);
    $list_url = solad_seo_url(get_pretty_url($board['bo_table']));
    $board_descriptions = array(
        SOLAD_THEME_VIDEO_BOARD => '솔애드 플레이어로 재생하는 동영상 갤러리예요. 관리자 화면의 플레이어 설정과 광고 편성이 게시판 영상에 그대로 적용돼요.',
        SOLAD_THEME_REQUEST_BOARD => '회원이 광고를 요청하고 관리자가 단계별로 처리하는 광고 요청 게시판이에요.',
    );
    if (isset($board_descriptions[$board['bo_table']])) {
        $seo['description'] = $board_descriptions[$board['bo_table']];
    }

    // 목록. 검색 결과는 색인하지 않는다.
    if (!$wr_id || empty($write['wr_id'])) {
        if ($stx) {
            return $seo;
        }
        $query = array();
        if ($sca) $query[] = 'sca='.urlencode($sca);
        if ((int) $page > 1) $query[] = 'page='.(int) $page;
        // 코어 목록 제목에는 빈 쪽 번호와 "페이지"가 붙으므로 게시판 이름을 쓴다.
        $seo['title'] = $board_title.((int) $page > 1 ? ' '.(int) $page.'쪽' : '');
        $seo['canonical'] = solad_seo_url(get_pretty_url($board['bo_table'], '', implode('&amp;', $query)));
        $seo['noindex'] = false;
        $seo['graph'][] = solad_seo_breadcrumb(array(array(SOLAD_SEO_SITE_NAME, $home), array($board_title, $list_url)));
        return $seo;
    }

    // 글 보기. 광고 요청 글은 예시 글이고, 비밀글은 발췌와 그림을 내지 않는다.
    if ($board['bo_table'] === SOLAD_THEME_REQUEST_BOARD || solad_seo_is_secret($write)) {
        return $seo;
    }

    $url = solad_seo_url(get_pretty_url($board['bo_table'], $write['wr_id']));
    $subject = solad_seo_text($write['wr_subject']);
    $excerpt = solad_seo_text($write['wr_content'], 120);
    if ($excerpt !== '') {
        $seo['description'] = $excerpt;
    }
    $seo['title'] = $subject;
    $seo['canonical'] = $url;
    $seo['noindex'] = false;
    $seo['graph'][] = solad_seo_breadcrumb(array(array(SOLAD_SEO_SITE_NAME, $home), array($board_title, $list_url), array($subject, $url)));

    if ($board['bo_table'] !== SOLAD_THEME_VIDEO_BOARD) {
        $seo['og_type'] = 'article';
        return $seo;
    }

    $image = solad_seo_video_image($board, $write);
    if ($image !== '') {
        $seo['image'] = solad_seo_url($image);
    }
    $seo['og_type'] = 'video.other';

    $video = array(
        '@type' => 'VideoObject',
        '@id' => $url.'#video',
        'name' => $subject,
        'description' => $excerpt !== '' ? $excerpt : $subject,
        'thumbnailUrl' => $seo['image'] !== '' ? $seo['image'] : solad_seo_brand('og-default.png'),
        'uploadDate' => solad_seo_date($write['wr_datetime']),
        'url' => $url,
        'inLanguage' => 'ko-KR',
    );
    $duration = solad_seo_duration(isset($write['wr_2']) ? $write['wr_2'] : 0);
    if ($duration !== '') {
        $video['duration'] = $duration;
    }
    // 이 사이트에 있는 파일(업로드한 MP4·WebM, 푼 HLS 묶음)만 contentUrl로 알린다. 외부 영상 주소는 넣지 않는다.
    $type = function_exists('solad_video_source_type') ? solad_video_source_type($write) : '';
    if ($type === 'file' || $type === 'hls_zip') {
        $src = solad_video_source($write, get_file($board['bo_table'], $write['wr_id']));
        if ($src !== '' && $src[0] === '/' && strpos($src, '//') !== 0) {
            $video['contentUrl'] = solad_seo_url($src);
        }
    }
    $seo['graph'][] = $video;

    return $seo;
}

function solad_seo_purchase_graph($url)
{
    $org = array('@id' => rtrim(G5_URL, '/').'/#organization');
    $brand = array('@type' => 'Brand', 'name' => SOLAD_SEO_SITE_NAME);
    $image = solad_seo_brand('og-default.png');

    $faq = array();
    foreach (solad_seo_faq() as $item) {
        $faq[] = array(
            '@type' => 'Question',
            'name' => $item['q'],
            'acceptedAnswer' => array('@type' => 'Answer', 'text' => $item['a']),
        );
    }

    return array(
        array(
            '@type' => 'Product',
            '@id' => $url.'#product-gnuboard',
            'name' => '솔애드 그누보드용',
            'description' => '그누보드 게시판에 동영상 플레이어와 광고를 붙여요. 로그인과 관리자 권한은 그누보드 것을 그대로 써요.',
            'brand' => $brand,
            'image' => $image,
            'url' => $url,
            'category' => '동영상 플레이어',
        ),
        array(
            '@type' => 'Product',
            '@id' => $url.'#product-lms',
            'name' => '솔애드 LMS용',
            'description' => '강의 영상의 학습 진도를 학습자별로 저장하고, 외부 LMS와 연결해요. 그누보드 없이 따로 설치해요.',
            'brand' => $brand,
            'image' => $image,
            'url' => $url,
            'category' => '강의 플레이어',
        ),
        array(
            '@type' => 'Service',
            '@id' => $url.'#custom-player',
            'name' => '커스텀 플레이어 제작',
            'serviceType' => '커스텀 플레이어 제작',
            'description' => '사이트에 맞춘 플레이어 기능을 따로 만들어 드려요. 그누보드용이나 LMS용 상품과 함께, 또는 따로 맡기실 수 있어요.',
            'provider' => $org,
            'url' => $url,
        ),
        array(
            '@type' => 'FAQPage',
            '@id' => $url.'#faq',
            'url' => $url,
            'mainEntity' => $faq,
        ),
    );
}

function solad_seo_head()
{
    $seo = solad_seo_page();
    $home = rtrim(G5_URL, '/').'/';
    $default_image = $seo['image'] === '';
    $image = $default_image ? solad_seo_brand('og-default.png') : $seo['image'];
    $url = $seo['canonical'] !== '' ? $seo['canonical'] : solad_seo_url(clean_xss_tags($_SERVER['REQUEST_URI']));

    $meta = array(
        array('name', 'description', $seo['description']),
        array('property', 'og:type', $seo['og_type']),
        array('property', 'og:site_name', SOLAD_SEO_SITE_NAME),
        array('property', 'og:locale', 'ko_KR'),
        array('property', 'og:title', $seo['title']),
        array('property', 'og:description', $seo['description']),
        array('property', 'og:url', $url),
        array('property', 'og:image', $image),
    );
    if ($default_image) {
        $meta[] = array('property', 'og:image:type', 'image/png');
        $meta[] = array('property', 'og:image:width', '1200');
        $meta[] = array('property', 'og:image:height', '630');
    }
    $meta[] = array('name', 'twitter:card', 'summary_large_image');
    $meta[] = array('name', 'twitter:title', $seo['title']);
    $meta[] = array('name', 'twitter:description', $seo['description']);
    $meta[] = array('name', 'twitter:image', $image);
    if ($seo['noindex']) {
        $meta[] = array('name', 'robots', 'noindex');
    }

    $out = array();
    foreach ($meta as $m) {
        $out[] = '<meta '.$m[0].'="'.$m[1].'" content="'.solad_seo_attr($m[2]).'">';
    }
    if ($seo['canonical'] !== '') {
        $out[] = '<link rel="canonical" href="'.solad_seo_attr($seo['canonical']).'">';
    }
    $out[] = '<link rel="icon" href="'.solad_seo_attr($home.'favicon.ico').'" sizes="32x32">';
    $out[] = '<link rel="icon" href="'.solad_seo_attr(solad_seo_brand('favicon.svg')).'" type="image/svg+xml">';
    $out[] = '<link rel="apple-touch-icon" href="'.solad_seo_attr(solad_seo_brand('apple-touch-icon.png')).'">';
    $out[] = '<link rel="manifest" href="'.solad_seo_attr($home.'site.webmanifest').'">';

    $org_id = $home.'#organization';
    $graph = array_merge(array(
        array(
            '@type' => 'WebSite',
            '@id' => $home.'#website',
            'name' => SOLAD_SEO_SITE_NAME,
            'url' => $home,
            'inLanguage' => 'ko-KR',
            'description' => SOLAD_SEO_DESCRIPTION,
            'publisher' => array('@id' => $org_id),
        ),
        array(
            '@type' => 'Organization',
            '@id' => $org_id,
            'name' => SOLAD_SEO_SITE_NAME,
            'url' => $home,
            'logo' => array('@type' => 'ImageObject', 'url' => solad_seo_brand('icon-512.png'), 'width' => 512, 'height' => 512),
            'email' => SOLAD_SEO_EMAIL,
            'contactPoint' => array('@type' => 'ContactPoint', 'contactType' => 'sales', 'email' => SOLAD_SEO_EMAIL, 'availableLanguage' => 'ko'),
        ),
    ), $seo['graph']);
    $json = json_encode(array('@context' => 'https://schema.org', '@graph' => $graph), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    if ($json !== false) {
        $out[] = '<script type="application/ld+json">'.$json.'</script>';
    }

    echo implode(PHP_EOL, $out).PHP_EOL;
}
