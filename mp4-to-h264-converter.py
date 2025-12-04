import sys
import os
import subprocess

if len(sys.argv) < 2:
    print("Usage: python converter.py <input_mp4_file>")
    sys.exit(1)

input_file = sys.argv[1]
if not os.path.isfile(input_file):
    print(f"File not found: {input_file}")
    sys.exit(1)

# Generate output file name
base, ext = os.path.splitext(input_file)
output_file = f"{base}_h264.mp4"

# ffmpeg command: convert video stream to h264, audio stream copy
cmd = [
    "ffmpeg",
    "-i", input_file,
    "-c:v", "libx264",
    "-c:a", "copy",
    "-y",  # Overwrite output file
    output_file
]

print(f"Converting {input_file} to H.264 format...")
result = subprocess.run(cmd)

if result.returncode == 0:
    print(f"Conversion successful! Output file: {output_file}")
else:
    print("Conversion failed.") 