# Google Drive Bundle Upload - Quick Guide

## Step 1: Upload the bundle to Google Drive

1. Open Google Drive (drive.google.com)
2. Create a folder called `InvestorApp-OTA`
3. Inside it, upload the bundle zip file:
   - File location: `/Users/ajaybendre/Projects/investor-app-ota-server/public/bundles/bundle-ota.zip`
   - This contains `index.android.bundle` inside the zip

## Step 2: Make the file publicly accessible

1. Right-click the uploaded `bundle-ota.zip` in Google Drive
2. Click "Share"
3. Under "General access", change from "Restricted" to "Anyone with the link"
4. Set permission to "Viewer"
5. Click "Done"

## Step 3: Get the direct download URL

1. Right-click the file → "Share" → "Copy link"
2. The link will look like: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
3. Extract the FILE_ID from the URL
4. The direct download URL is: `https://drive.google.com/uc?export=download&id=FILE_ID`

## Step 4: Update releases.json

Edit `/Users/ajaybendre/Projects/investor-app-ota-server/data/releases.json`
and replace the bundleUrl with your Google Drive URL.

## Example

If your sharing link is:
```
https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing
```

Your FILE_ID is: `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`

Your bundleUrl should be:
```
https://drive.google.com/uc?export=download&id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ
```
