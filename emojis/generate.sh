#!/bin/bash

set -e

# Verify prereq
if ! command -v composite &> /dev/null; then
    echo "Error: 'composite' (ImageMagick) is not installed."
    exit 1
fi

if ! command -v yq &> /dev/null; then
    echo "Error: 'yq' is required to parse emoji_mapping.yml."
    exit 1
fi

mkdir -p ./composites

# Create for all icons
for file in ./icons_stroke/*.png; do
    if [ ! -e "$file" ]; then
        continue
    fi

    filename=$(basename "$file" .png)

    # Lookup name mapping
    mapped_name=$(yq -r ".names.\"$filename\"" emoji_mapping.yml)

    if [ "$mapped_name" == "null" ] || [ -z "$mapped_name" ]; then
        echo "Error: No mapping found for '$filename' in emoji_mapping.yml"
        exit 1
    fi

    # Overlay stroke onto the background with (hopefully) deterministic output
    composite -gravity center \
        -strip \
        -define png:compression-level=9 \
        -define png:compression-filter=0 \
        -define png:compression-strategy=0 \
        "$file" \
        ./background.png "./composites/${mapped_name}.png"

    echo "Created composite for '$filename' -> '$mapped_name'"
done
