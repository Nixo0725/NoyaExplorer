# Noya Explorer

# What is Noya Explorer

Noya Explorer is a modern file explorer project, build with Rust, Tauri, React and Typescript.
The idea is not just to remake windows explorer with a better design. I want to build a file explorer who doesn't suck and help you to search, organise and more 
And yes, part of the reason I chose Rust is because rewriting everything in Rust is apparently the solution to every problem in the world obviously.
So I want to build it for sole questions like:
* What is taking the most space on my disk
* Where are my biggest files?
* Who many time I use this app?
* Do I have duplicated files?
* Why is my downloads folder such a mess?
* Are they weird or suspiciopus files somewhere?
* How can I clean my storage without deleting something important?
 
# Why im making this

I often have a lot of files everywhere so obviously first beacause it respond to a problem for me (hope for u too)
I think classic file explorer are too old and we need a new experience with integrating tools.
I want it to mix the best of a classic explorer, a storage analysis tool, a great search engine and a category sytem

# Project status

For now my goal is to build a simple but solid first version. I want to make a usable base first, then add more advanced features step by step.

# First version goal

The first version should be able to:
* browse local folders
* show files in a clean way
* open files and folders
* search files quickly
* sort files by name, size, type and date
* group files by categories
* show what take space
* have a simple, modern and fast interface

# Features

# File navigation

Noya Explorer should allow the user to:

* browse local folders
* open files
* open folders
* go back to previous folders
* switch folders quickly
* use a cleaner interface than the default file explorer

# Search

The goal is to have a search that is actually useful.

Later, I want to add filters like:

* file name
* extension
* file size
* modification date
* file type
* folder location
* recent files
* large files
* old files
* unused files

# File categories

Noya Explorer should automatically group files into categories.

Examples:

* images
* videos
* music
* documents
* archives
* executables
* scripts
* code projects
* temporary files
* game files
* unknown files

The goal is to quickly understand what is inside a folder, even when the folder is a mess.

# Storage analysis

One of the main goals of Noya Explorer is to show what takes space on the computer.

Planned features:

* show the biggest files
* show the biggest folders
* show storage usage by category
* show storage usage by extension
* detect old files
* detect duplicated files
* find folders that are taking too much space

# Custom spaces

Later, I want Noya Explorer to manage multiple important locations at the same time.

For example:

* Downloads
* Desktop
* Documents
* code project folders
* game folders
* external drives
* backup folders
* server or NAS folders

The idea is to create custom spaces depending on what the user wants to manage.

Examples:

* project space
* game space
* document space
* media space
* cleanup space

# Suspicious file detection

Noya Explorer will not be an antivirus.

But I want to add a feature that helps detect weird files.

Examples:

* .exe files in strange folders
* double extensions like image.png.exe
* weird scripts inside Downloads
* hidden files in unusual places
* very recent unknown executables
* misleading file names

The goal is not to promise perfect security.

The goal is just to help the user notice files that may deserve attention.

# Privacy

Noya Explorer should work locally.

The idea is that the user's files and folder structure stay on their own computer.

I do not want the app to require uploading files or personal folder data to an external server just to work.

# Tech stack

The project uses:

* Rust
* Tauri
* TypeScript
* React
* Tailwind CSS

I chose this stack because:

* Rust is fast and reliable for file system operations
* Tauri allows me to build a lightweight desktop app
* React and TypeScript are good for building a modern interface
* Tailwind CSS helps me move faster on the design

# Roadmap

# MVP

* [ ] Browse local folders
* [ ] Display files
* [ ] Open files
* [ ] Open folders
* [ ] Basic search
* [ ] Sort by name
* [ ] Sort by size
* [ ] Sort by date
* [ ] Sort by type
* [ ] File type icons
* [ ] File categories
* [ ] Folder size display
* [ ] Simple storage overview
* [ ] Clean and fast interface

# Advanced version

* [ ] Disk usage visualization
* [ ] Biggest file detection
* [ ] Biggest folder detection
* [ ] Duplicate file detection
* [ ] Suspicious file detection
* [ ] Custom spaces
* [ ] Advanced filters
* [ ] Cleanup suggestions
* [ ] Code project detection
* [ ] File activity history
* [ ] Export reports
* [ ] Plugin system
* [ ] Optional AI-assisted organization

# Installation

The project is not ready for a public release yet.

When the first usable version is ready, I will add releases here.

# Run in development

Clone the project:

* git clone 
* cd noya-explorer

Install dependencies:

* npm install

Run the app:

* npm run tauri dev

Build the app:

* npm run tauri build

# Project structure

* src/ : frontend source code
* src-tauri/ : Rust and Tauri backend
* public/ : static assets
* README.md : project documentation
* package.json : dependencies and scripts

# Design goals

I want Noya Explorer to feel:

* fast
* clean
* useful
* easy to understand
* not overloaded
* nice to use
* simple enough for normal users
* powerful enough for people who like to tinker with their system

I do not want an interface full of buttons everywhere.

The goal is to show the right information at the right moment.

# Long-term vision

In the long term, I want Noya Explorer to become a real local intelligence tool for files.

Not just:

* here are your files

But more like:

* here is what takes space
* here is what seems important
* here is what seems useless
* here is what is old
* here is what looks weird
* here is what you could clean
* here is how your storage is organized

# Future ideas

* very fast search
* local indexing
* smart organization suggestions
* file timeline
* project view
* category view
* external drive analysis
* NAS integration
* smarter backups
* local assistant to organize files
* developer mode to detect projects, dependencies and heavy folders

# AI usage

I may use AI to help review or speed up some parts of the project.

But the goal is to understand what I am doing, adapt the code, and build a real project that I actually control.

# License

The license is not decided yet.

For now, the project is mainly in development and experimentation.

# Author

Created by Nixo.

Noya Explorer is part of my goal to improve as a developer, learn Rust and Tauri seriously, and build tools that I would actually use myself.
