# oem-gis-center-source
## Local Machine Setup
Installation Guide: https://developers.arcgis.com/experience-builder/guide/install-guide/
1. Install ArcGIS Experience Builder Devleoper Edition by [downloading](https://developers.arcgis.com/downloads/#arcgis-experience-builder) and unzipping the required files
2. Copy the widgets folder into ArcGISExperienceBuidler/client/your-extensions/widgets and copy the apps folder into ArcGISExperienceBuilder/server/public/apps (following the naming convention for app folders)
3. Go to [ArcGIS Developers Dashboard](https://developers.arcgis.com/applications/) and create new app or get credentials for an existing app
4. Rename the ArcGISExperienceBuilder/client/node-modules/@arcgis/core folder to "esri" and move the folder to ArcGISExperienceBuidler/client
   
## Running Experience Builder
1. Open a terminal and navigate to ArcGISExperienceBuilder/server
2. Run `npm install`
3. Run `npm start`
4. The server is now running and can be viewed at http://localhost:3001
5. Open another instance of a terminal and navigate to ArcGISExperienceBuilder/client
6. Run `npm start`

## Deployment
Deployment Guide: https://developers.arcgis.com/experience-builder/guide/deployment-topics/
1. Download the OEM Dashboard experience by going to the experience gallery homepage, clicking the three dots, and clicking download
2. Unzip the downloaded experience
3. Push to a GitHub repo
4. If GitHub pages is not configured, go to Settings > Pages
5. Under Build and Deployment, select GitHub Actions and use the Deploy Jekyll with GitHub Pages dependencies preinstalled workflow
