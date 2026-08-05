# ClipSpark AI

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

Build a modern SaaS web application called "ClipMind AI" (temporary name).

The goal is to create the most advanced AI-powered video repurposing platform, capable of transforming long-form videos into highly engaging vertical short videos for TikTok, Instagram Reels and YouTube Shorts.

IMPORTANT:

Do NOT use Lovable AI for processing videos or AI tasks.

Lovable must only generate the frontend, backend, database, authentication, API integrations and application architecture.

All AI features must be modular and consume external APIs so providers can be swapped without changing the application.

========================================================

TECH STACK

Frontend

- React

- TypeScript

- Vite

- TailwindCSS

- shadcn/ui

- Framer Motion

- React Hook Form

- TanStack Query

- React Router

Backend

- Supabase

- PostgreSQL

- Supabase Auth

- Edge Functions

- Supabase Storage

- Row Level Security

Video Processing

The architecture must support external services such as:

- FFmpeg

- Whisper

- Deepgram

- AssemblyAI

- Gemini

- Claude

- OpenAI

- ElevenLabs

All providers must be configurable using environment variables.

========================================================

APPLICATION ARCHITECTURE

Follow Clean Architecture.

Separate everything into modules.

Never place business logic inside components.

Structure:

src/

components/

pages/

hooks/

services/

api/

workers/

contexts/

types/

utils/

constants/

lib/

styles/

layouts/

========================================================

AUTHENTICATION

Implement:

Email login

Google OAuth

Register

Forgot password

Reset password

Protected routes

User session

========================================================

DATABASE

Create tables:

users

projects

videos

transcriptions

clips

exports

subscriptions

usage

api_keys

processing_jobs

========================================================

HOME DASHBOARD

Display:

Projects

Videos processed

Credits remaining

Storage usage

Processing queue

Latest clips

Recent activity

Quick actions

Analytics

========================================================

UPLOAD PAGE

Allow:

Paste YouTube URL

Upload MP4

Drag and Drop

Import from Google Drive

Import from Dropbox

Import from OneDrive

========================================================

VIDEO ANALYSIS

After importing a video automatically retrieve:

Title

Thumbnail

Duration

Channel

Views

Description

Language

Resolution

========================================================

PROCESSING PIPELINE

The application must support the following workflow.

Download video

Extract audio

Generate transcript

Speaker detection

Scene detection

Emotion detection

Topic segmentation

Silence detection

Identify hooks

Detect storytelling moments

Detect emotional moments

Detect viral moments

Generate multiple clips

Burn subtitles

Export

========================================================

AI MODULE

The AI module must be independent.

It should receive only the transcript.

The AI must identify:

Hooks

Curiosity loops

Open loops

Storytelling

High emotional moments

Strong opinions

Funny moments

Educational moments

Questions

Calls to action

Pattern interruptions

Moments likely to increase retention

Every clip should receive:

Virality Score (0-100)

Engagement Score

Retention Score

Sentiment

Category

========================================================

CLIP GENERATION

Generate clips automatically.

Supported durations:

15 sec

30 sec

45 sec

60 sec

90 sec

Auto

Users may generate unlimited clips.

========================================================

SUBTITLES

Generate animated subtitles.

Support:

Word highlighting

Current word highlight

Emoji insertion

Custom fonts

Custom colors

Background

Shadow

Stroke

Animation presets

========================================================

EDITOR

Create a lightweight timeline editor.

Allow:

Trim

Split

Crop

Zoom

Pan

Position subtitles

Add logo

Add watermark

Change fonts

Adjust timing

Mute

Volume

Background music

========================================================

EXPORT

Formats:

MP4

1080x1920

720x1280

30fps

60fps

High Quality

========================================================

SOCIAL MEDIA

Generate automatically:

TikTok Caption

Instagram Caption

YouTube Shorts Description

Hashtags

SEO Title

Thumbnail Title

Hook Suggestion

Pinned Comment

Call To Action

========================================================

CONTENT SCORE

Each generated clip should display:

Virality Score

Retention Score

Emotion Score

Curiosity Score

Watch Time Prediction

Share Probability

========================================================

QUEUE SYSTEM

Every task should run independently.

Jobs:

Download

Transcription

AI Analysis

Clip Generation

Subtitle Rendering

Video Rendering

Export

========================================================

USER SETTINGS

Language

Theme

Subtitle Preferences

Export Quality

Default Clip Length

Brand Kit

========================================================

BRAND KIT

Upload:

Logo

Intro

Outro

Fonts

Primary Color

Secondary Color

Watermark

========================================================

SUBSCRIPTIONS

Prepare the project for Stripe.

Plans:

Free

Pro

Business

Enterprise

========================================================

DESIGN

Style inspiration:

Linear

Vercel

Raycast

Arc Browser

Notion

Apple

Extremely modern.

Minimal.

Rounded corners.

Large spacing.

Glassmorphism where appropriate.

Smooth animations.

Responsive.

Desktop-first.

Mobile optimized.

========================================================

PERFORMANCE

Lazy loading

Code splitting

Optimized images

Caching

Virtualization

Skeleton loaders

Optimistic updates

========================================================

SECURITY

JWT

Row Level Security

Rate limiting

API validation

Input sanitization

========================================================

FUTURE FEATURES

TikTok Downloader

Instagram Downloader

Facebook Downloader

Podcast Mode

Automatic publishing

Calendar

Workspace

Team collaboration

Comments

Analytics

AI Thumbnail Generator

AI Title Generator

AI Script Generator

Voice Cloning

AI Avatar

Affiliate Program

API Access

White Label

========================================================

CODE QUALITY

Use TypeScript everywhere.

Reusable components only.

No duplicated code.

Clean Architecture.

SOLID principles.

Scalable folder structure.

Well documented.

Highly maintainable.

========================================================

IMPORTANT

The project must be production-ready.

Do not use mock components unless explicitly necessary.

Create reusable services for every external API.

Every AI provider must be replaceable through environment variables without changing the application logic.

The application must be built to scale from 100 users to millions of users.

Think like a senior software architect from Google, Vercel and Stripe.

Generate a premium SaaS, not just a demo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://clipcraft-ai-13.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9582b62c-883b-4c92-8457-a8c344e67bea).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
