import yt_dlp
import sys

# Get command line arguments
if len(sys.argv) < 2:
    print("Usage: python main.py <YouTubeVideoLink>")
    sys.exit(1)

url = sys.argv[1]

def progress_hook(d):
    if d['status'] == 'downloading':
        percent = d.get('_percent_str', '').strip()
        speed = d.get('_speed_str', '').strip()
        eta = d.get('_eta_str', '').strip()
        print(f"\rDownloading progress: {percent}  Speed: {speed}  Remaining time: {eta}", end='')
    elif d['status'] == 'finished':
        print("\nDownload completed!")

# yt-dlp parameters, prioritize high bitrate
ydl_opts = {
    'format': 'bestvideo+bestaudio/best',
    'merge_output_format': 'mp4',
    'progress_hooks': [progress_hook],
    'outtmpl': '%(title)s.%(ext)s',
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download([url]) 