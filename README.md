# docker-oem-dashboard
Experience builder dockerized with OEM Dashboard widgets for easy development
1. Clone the repository.
```
git clone https://github.com/mepps/docker-oem-dashboard.git
cd docker-oem-dashboard
```
Optional: Build the docker image from the local docker file. The docker-compose uses the remote image, but I'm including this in case we decide to use it.
```
docker build -f Dockerfile-1.9 -t esri-exb:exb-1.9 .
```
2. Create the docker container
```
cd docker-exb
docker-compose up
```
3. Navigate to https://localhost:3001 and enter your url and clientId.
