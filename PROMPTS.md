# Prompts

Copy, paste, change the words in brackets. Every prompt works in Claude Code, Codex, Cursor or any agent with the skills installed. Flags and plain English are interchangeable: `--length 45` and "make it 45 seconds" mean the same thing.

## Install it for me

```text
Install brag-motion (github.com/shaaz1000/brag-motion) for this agent: clone it, link its two skills
(skills/brag and skills/huashu-motion) into my skills folder, run om doctor, and if FFmpeg is missing
run om setup. Then tell me the one command to start.
```

## Launch films

```text
let's /brag
```

```text
/brag --length 30            a 30-second launch film (the default)
/brag --length 45            45 seconds: three highlights, two drops
/brag --length 60            a full minute: the whole story, two drops, a montage of everything else
```

```text
/brag --length 45 --tone polished. The one thing it must leave behind: [nothing reaches a patient until the doctor approves].
Show the real UI in use: [intake on the phone → queue → consultation → Approve & send → WhatsApp].
```

```text
/brag https://[your-site.com] --length 30 --format vertical
```

```text
/brag --tone "[fake Series A launch from 2016 / museum exhibit / overproduced mobile game ad]"
```

## Feature films

```text
/brag every feature. List the product's capabilities from the code first and show me the list.
Then one 20-second film per feature, 16:9 and 9:16, each with its own score, all collected in
[~/Downloads/launch-films]. Build them in parallel if you can.
```

```text
/brag just [the new search / the patient history / the booking page] — 20 seconds, vertical.
```

## Formats

```text
Make a 9:16 version of brag-output/composition for Reels: fork it with om fork, re-aim the camera
and captions for the tall frame — don't crop.
```

```text
/brag --length 30 --format both      one plan, a 16:9 and a 9:16 film
```

## Sound and voice

```text
/brag --voice. Write a 4-sentence script in my product's voice and read it with a system voice;
the music ducks under it, motion lands on the words.
```

```text
/brag --voice with my recording: [voice.m4a]. Subtitles on.
```

```text
Score it without melodic instruments — percussion and sound design only.
```

```text
Install the real instruments (om samples build) and re-score it: piano and strings, still on the same beat grid.
```

## Truth and privacy

```text
Run om claims against the product source and go through every line it could not find.
For each one tell me: real copy reworded, a number from the database (say which table), a caption,
or an invention. Remove the inventions.
```

```text
Does the film show the product doing anything it doesn't actually do? Check the behaviour in the
code (what is sent, when, after which button), not only the words.
```

```text
Replace every real name, phone number and email on screen with fictional stand-ins and say which.
```

## Editing — point at the frame

```text
Open the studio for brag-output/composition and wait for my comments.
```

Then, in the studio: press **C**, click the thing, type the note. Notes that work well:

```text
hold this a beat longer — everything after moves with it
this number is wrong, it should come from [the September payments]
the cut here is off the beat
make the hook start moving in the very first frame
too slow — this stretch needs a burst
use our real logo, it's at [public/logo.svg]
```

## Deliver

```text
Render it with motion blur, run om qa, then om deliver --to [~/Downloads/launch-films]
and write share copy for [X / LinkedIn], one or two sentences, no "excited to share".
```

## When something is off

```text
om doctor says FFmpeg is missing and brew install fails — run om setup instead.
```

```text
The agent's shell has an old Node. The om launcher picks a Node 22+ from nvm, fnm or Volta;
if there is none: nvm install 24.
```

```text
My machine is slow while several films render — render one at a time and skip --blur until the final export.
```
