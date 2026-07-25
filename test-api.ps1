$body = '{"items":[{"id":"1","name":"Tej"}],"catalog":[],"categories":[]}'
$res = Invoke-WebRequest -Uri 'https://jsonblob.com/api/jsonBlob' -Method Post -Body $body -ContentType 'application/json'
$location = $res.Headers['Location']
Write-Host "Created Blob URL: $location"

$getRes = Invoke-RestMethod -Uri $location -Method Get
Write-Host "Fetched Items Count: $($getRes.items.Count)"
