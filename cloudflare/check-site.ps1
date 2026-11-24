<#
.SYNOPSIS
    Pass/fail checks for landonarcher.com on Cloudflare.

.DESCRIPTION
    Checks the five sites, Pictures' search and picture URLs, the redirects, the
    manifests, the service workers and the Game Room's photos. One check runs a
    real search, which costs one Openverse call.

    It looks the site up through Google's public DNS and sends every request to the
    address that returns, so a stale DNS cache on this PC can't send it elsewhere.
    -Local checks `npm run dev` (http://localhost:8787) instead, skipping the DNS
    and https checks. Add -Port when wrangler picked another port.

    Windows only (curl.exe and Resolve-DnsName). Runs in Windows PowerShell 5.1 and
    PowerShell 7. The exit code is the number of failed checks.

.EXAMPLE
    .\check-site.ps1

.EXAMPLE
    .\check-site.ps1 -Local
#>
param(
    [switch] $Local,
    # The port `npm run dev` is on. Wrangler moves to 8788 when 8787 is taken.
    [int] $Port = 8787
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$Domain = 'landonarcher.com'
$PublicDns = '8.8.8.8'
$script:EdgeIp = $null
$script:Failed = 0

# Only the fixed Pictures worker has this line. The old one deleted every other
# app's caches, Marble Run's included.
$PicturesWorkerFix = "name.indexOf('pf-') === 0"

function Write-Result([string] $Result, [string] $Check, [string] $Detail) {
    $colors = @{ PASS = 'Green'; FAIL = 'Red'; INFO = 'Gray' }
    if ($Result -eq 'FAIL') { $script:Failed++ }

    $line = '{0,-5} {1}' -f $Result, $Check
    if ($Detail) { $line += "  [$Detail]" }
    Write-Host $line -ForegroundColor $colors[$Result]
}

function Get-Verdict([bool] $Ok) {
    if ($Ok) { 'PASS' } else { 'FAIL' }
}

# One GET with curl.exe; redirects are not followed. Once the site's address is
# known, the host name is pinned to it.
function Invoke-Probe([string] $Url) {
    $headerFile = [IO.Path]::GetTempFileName()
    $bodyFile = [IO.Path]::GetTempFileName()
    $errorFile = [IO.Path]::GetTempFileName()
    try {
        $curlArgs = @('-sS', '--max-time', '40', '--ssl-revoke-best-effort', '--stderr', $errorFile,
            '-o', $bodyFile, '-D', $headerFile, '-w', '%{http_code}')
        if ($script:EdgeIp) {
            $uri = [Uri] $Url
            $curlArgs += @('--resolve', ('{0}:{1}:{2}' -f $uri.Host, $uri.Port, $script:EdgeIp))
        }

        $code = & curl.exe @curlArgs $Url

        $headers = @{}
        foreach ($line in (Get-Content -LiteralPath $headerFile)) {
            if ($line -match '^([A-Za-z0-9-]+):\s*(.*)$') {
                $headers[$Matches[1].ToLowerInvariant()] = $Matches[2].Trim()
            }
        }

        [pscustomobject]@{
            Status  = [int] "$code"
            Error   = ([IO.File]::ReadAllText($errorFile)).Trim()
            Headers = $headers
            Body    = [IO.File]::ReadAllText($bodyFile)
            Bytes   = (Get-Item -LiteralPath $bodyFile).Length
        }
    }
    finally {
        Remove-Item -LiteralPath $headerFile, $bodyFile, $errorFile -ErrorAction SilentlyContinue
    }
}

function Get-Outcome($Response) {
    if ($Response.Status -eq 0) {
        return "no response: $($Response.Error)"
    }

    $text = "HTTP $($Response.Status)"
    if ($Response.Headers['content-type']) { $text += ", $($Response.Headers['content-type'])" }
    if ($Response.Headers['location']) { $text += ", Location: $($Response.Headers['location'])" }
    return $text
}

function Test-Page([string] $Url) {
    $response = Invoke-Probe $Url
    $ok = $response.Status -eq 200
    $detail = Get-Outcome $response
    if (-not $Local -and $response.Status -ne 0 -and $response.Headers['server'] -ne 'cloudflare') {
        $ok = $false
        $detail += ", not served by Cloudflare (Server: $($response.Headers['server']))"
    }
    Write-Result (Get-Verdict $ok) "$Url returns 200" $detail
}

function Test-Redirect([string] $Url, [string] $To) {
    $response = Invoke-Probe $Url
    $location = $response.Headers['location']
    $lands = $location -eq $To -or $location -eq ([Uri] $To).PathAndQuery
    Write-Result (Get-Verdict ($response.Status -eq 301 -and $lands)) "$Url redirects (301) to $To" (Get-Outcome $response)
}

function Test-ContentType([string] $Url, [string] $Type) {
    $response = Invoke-Probe $Url
    $actual = "$($response.Headers['content-type'])".Split(';')[0].Trim()
    Write-Result (Get-Verdict ($response.Status -eq 200 -and $actual -eq $Type)) "$Url is $Type" (Get-Outcome $response)
}

function Test-Header([string] $Url, [string] $Name, [string] $Text, [string] $Check) {
    $response = Invoke-Probe $Url
    $value = "$($response.Headers[$Name])"
    $ok = $response.Status -eq 200 -and $value.Contains($Text)
    Write-Result (Get-Verdict $ok) "$Url $Check" "${Name}: $value"
}

function Test-Contains([string] $Url, [string] $Text, [string] $Check) {
    $response = Invoke-Probe $Url
    $ok = $response.Status -eq 200 -and $response.Body.Contains($Text)
    $detail = Get-Outcome $response
    if ($response.Status -eq 200 -and -not $ok) { $detail += ', text not found' }
    Write-Result (Get-Verdict $ok) "$Url $Check" $detail
}

# Returns the search result, so the picture checks can use one of its images.
function Test-Search([string] $Url, [string] $Check, [switch] $NeedImages) {
    $response = Invoke-Probe $Url
    $ok = $response.Status -eq 200 -and "$($response.Headers['content-type'])" -like 'application/json*'
    $detail = Get-Outcome $response
    $result = $null

    if ($ok) {
        try {
            $result = ConvertFrom-Json $response.Body
            $detail += ", origin: $($result.origin), $(@($result.images).Count) images"
            if ($NeedImages -and @($result.images).Count -eq 0) { $ok = $false }
        }
        catch {
            $ok = $false
            $detail += ', body is not JSON'
        }
    }
    if ($response.Headers['cache-control'] -ne 'no-store') {
        $ok = $false
        $detail += ", Cache-Control: $($response.Headers['cache-control'])"
    }

    Write-Result (Get-Verdict $ok) "$Url $Check" $detail
    if ($ok) { $result }
}

function Test-Picture([string] $Url) {
    $response = Invoke-Probe $Url
    $ok = $response.Status -eq 200 -and "$($response.Headers['content-type'])" -like 'image/*'
    Write-Result (Get-Verdict $ok) "$Url is a picture" "$(Get-Outcome $response), $($response.Body.Length) chars"
}

# The Game Room's photos: listed, small, and kept out of search results.
function Test-Photos([string] $Base) {
    $response = Invoke-Probe "$Base/photos/manifest.json"
    $photos = @()
    if ($response.Status -eq 200) {
        try { $photos = @((ConvertFrom-Json $response.Body).photos) } catch { }
    }
    Write-Result (Get-Verdict ($photos.Count -gt 0)) "$Base/photos/manifest.json lists photos" "$(Get-Outcome $response), $($photos.Count) photos"
    if ($photos.Count -eq 0) { return }

    $url = "$Base/photos/$($photos[0].src)"
    $photo = Invoke-Probe $url
    $ok = $photo.Status -eq 200 -and $photo.Bytes -le 800KB
    Write-Result (Get-Verdict $ok) "$url is a small photo" "$(Get-Outcome $photo), $([math]::Round($photo.Bytes / 1KB)) KB"
    if (-not $Local) {
        $tag = $photo.Headers['x-robots-tag']
        Write-Result (Get-Verdict ($tag -eq 'noindex')) "$Base/photos/ asks search engines not to index" "X-Robots-Tag: $tag"
    }
}

# The Game Room's narrator: every line listed, and the clips served as audio.
function Test-Voice([string] $Base) {
    $response = Invoke-Probe "$Base/voice/manifest.json"
    $clips = @()
    if ($response.Status -eq 200) {
        # read the clip names straight from the text: ConvertFrom-Json refuses keys that differ only
        # in case, and the manifest has both "A! Nice tracing!" and "a! Nice tracing!"
        $clips = @([regex]::Matches("$($response.Body)", '"[^"]+":\s*"([0-9a-f]{12}\.mp3)"') | ForEach-Object { $_.Groups[1].Value })
    }
    Write-Result (Get-Verdict ($clips.Count -gt 0)) "$Base/voice/manifest.json lists the narrator's lines" "$(Get-Outcome $response), $($clips.Count) lines"
    if ($clips.Count -eq 0) { return }

    $url = "$Base/voice/$($clips[0])"
    $clip = Invoke-Probe $url
    $ok = $clip.Status -eq 200 -and "$($clip.Headers['content-type'])" -like 'audio/mpeg*' -and $clip.Bytes -le 120KB
    Write-Result (Get-Verdict $ok) "$url is a short audio clip" "$(Get-Outcome $clip), $([math]::Round($clip.Bytes / 1KB)) KB"
}

function Test-Nameservers {
    $check = "$Domain uses Cloudflare nameservers"
    try {
        $servers = @(Resolve-DnsName -Name $Domain -Type NS -Server $PublicDns -DnsOnly |
                Where-Object { $_.Type -eq 'NS' } | ForEach-Object { $_.NameHost })
    }
    catch {
        Write-Result FAIL $check $_.Exception.Message
        return
    }
    $ok = $servers.Count -gt 0 -and @($servers | Where-Object { $_ -notlike '*.ns.cloudflare.com' }).Count -eq 0
    Write-Result (Get-Verdict $ok) $check ($servers -join ', ')
}

function Get-SiteAddress([string] $HostName) {
    try {
        @(Resolve-DnsName -Name $HostName -Type A -Server $PublicDns -DnsOnly |
                Where-Object { $_.Type -eq 'A' } | ForEach-Object { $_.IPAddress })[0]
    }
    catch {
        $null
    }
}

Write-Host ''

if ($Local) {
    $site = "http://localhost:$Port"
    Write-Host "Checking $site (npm run dev)." -ForegroundColor Cyan
}
else {
    $site = "https://$Domain"
    Write-Host "Checking $site through public DNS." -ForegroundColor Cyan
    Test-Nameservers
    $script:EdgeIp = Get-SiteAddress $Domain
}

foreach ($path in '/', '/games/', '/marblerun/', '/search/', '/bubble-wall/') { Test-Page "$site$path" }
foreach ($path in '/games', '/marblerun', '/search', '/bubble-wall') { Test-Redirect "$site$path" "$site$path/" }
foreach ($app in 'games', 'marblerun', 'search', 'bubble-wall') {
    Test-ContentType "$site/$app/manifest.webmanifest" 'application/manifest+json'
}
Test-Contains "$site/marblerun/sw.js" "const VERSION = 'mr-" 'is Marble Run''s worker'
Test-Contains "$site/games/sw.js" "const VERSION = 'lg-" 'is the Game Room''s worker'
Test-ContentType "$site/games/fonts/fredoka-latin.woff2" 'font/woff2'
Test-Photos "$site/games"
Test-Voice "$site/games"
Test-Contains "$site/search/sw.js" $PicturesWorkerFix 'has the cache fix'
Test-Contains "$site/bubble-wall/sw.js" 'const PREFIX = "bubble-wall-"' 'is Bubble Wall''s worker'
Test-Contains "$site/bubble-wall/" 'Content-Security-Policy' 'carries its security policy'
Test-ContentType "$site/bubble-wall/icons/apple-touch-icon-180.png" 'image/png'
Test-Header "$site/bubble-wall/" 'cache-control' 'no-transform' 'tells Cloudflare to add nothing to the page'
Test-Header "$site/bubble-wall/" 'x-robots-tag' 'noindex' 'asks search engines not to index'

$null = Test-Search "$site/search/api/search?q=cat" 'answers (cache-only lookup)'
$result = Test-Search "$site/search/api/search?q=cat&live=true" 'finds pictures (real search)' -NeedImages
if ($result) {
    $image = @($result.images)[0]
    Test-Picture "$site/search/$($image.thumbUrl)"
    Test-Picture "$site/search/$($image.fullUrl)"
}

if (-not $Local) {
    Test-Page "https://www.$Domain/"
    Test-Redirect "http://$Domain/" "$site/"
}

Write-Host ''
if ($script:Failed -eq 0) {
    Write-Host 'All checks passed.' -ForegroundColor Green
}
else {
    Write-Host "$($script:Failed) check(s) failed." -ForegroundColor Red
}

exit $script:Failed
