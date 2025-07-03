Icons from [Lucide](https://lucide.dev)
- Color: #cdd6f4
- Stroke width: 2px
- Size: 40px

## Build the Docker image

The Docker image only contains the dependencies needed to run the script:
- `imagemagick`
- `yq`

If you already have these dependencies installed, you can run the script
directly without using Docker.

The script and assets are mounted in the container, so you don't need to rebuild
the image every time you change the script or assets.

```sh
docker build -t sushii-modmail-emojis .
```

## Run the Docker image

```sh
docker run --rm -it \
    -v "$PWD":/workspace \
    -w /workspace \
    sushii-modmail-emojis
```
