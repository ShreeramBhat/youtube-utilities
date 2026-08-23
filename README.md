# YouTube Utilities

Chrome extension with small YouTube quality-of-life tools.

This repo will grow. Tools so far: **Hide replies** and **pause channel intros**.

## Hide replies

YouTube often will not collapse a comment thread until every nested **Show more replies** is opened first. This tool adds **Hide replies** at the bottom of the thread, next to **Show more replies**, so you can close it without expanding the whole tree.

- Puts **Hide replies** only at the bottom of an expanded parent thread, next to **Show more replies**
- Does not add Hide replies at the top or next to nested / intermediate Show more controls
- Clicking **Hide replies** collapses that thread immediately via YouTube’s own reply-collapse API
- Clicking the left thread line also collapses, even if nested replies are still closed
- Uses YouTube’s own localized “Hide replies” label when it is present in the page

## Pause channel intros

A creator’s homepage often autoplays a featured intro / trailer. This tool leaves the player on the page and pauses it after the first frame. Click it if you want it to play.

It only targets the channel homepage trailer (`ytd-channel-video-player-renderer` / `#c4-player`). Watch pages, Shorts, and hover previews are left alone.

## Install (unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `youtube-utilities`
5. Reload any open YouTube tabs

Click the toolbar icon to toggle features.

If you previously loaded this as **YouTube Hide Replies**, remove that unpacked extension and load this folder instead. The on-disk path changed, so Chrome treats it as a new unpacked install.

## Use

**Hide replies**

1. Open a video and expand a comment thread
2. Scroll to the bottom of that thread — **Hide replies** sits next to **Show more replies**
3. Click it to close the thread — you do not need to open nested replies first
4. Or click the vertical line on the left of the thread

**Channel intro**

1. Open a creator’s homepage (`youtube.com/@channel`)
2. The featured intro/trailer stays paused
3. Click the player if you want it to play

## Permissions

- `storage` — saves popup settings
- `scripting` — injects the page-world collapse hook on YouTube
- Access to `youtube.com` — injects the hide controls into the comments section
