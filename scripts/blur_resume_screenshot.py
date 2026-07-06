"""Create a blurred version of the resume request screenshot.

Blurs the recruiter's name, title/company, and email address.
Keeps Andrew's name and the reply text visible.
"""
from PIL import Image, ImageFilter

img = Image.open("images/request for resume.png")

# Regions to blur (x1, y1, x2, y2) — recruiter identity:
# 1. "Devendra Kumar" name + verified badge + "Author" badge
# 2. "Technical Recruiter, NexGent Consulting LLC" title line
# 3. "Devendra@nexgentconsulting.com" email in the reply text
blur_regions = [
    (128, 228, 315, 252),   # Name: "Devendra Kumar" + badges
    (128, 252, 345, 272),   # Title: "Technical Recruiter, NexGent Consulting LLC"
    (105, 322, 435, 340),   # Email link text only (not the "Please send" line above)
]

BLUR_RADIUS = 15

for region in blur_regions:
    cropped = img.crop(region)
    blurred = cropped.filter(ImageFilter.GaussianBlur(BLUR_RADIUS))
    img.paste(blurred, region)

output_path = "images/resume-request-blurred.png"
img.save(output_path)
print(f"Saved blurred image to: {output_path}")
