File-Based Blog System Requirements
Overview
A lightweight, file-based blogging system built on ASP.NET Core 10 Preview 4 Minimal API that stores content as files rather than in a database.

Core Features
Content Management
Blog Posts: Support for title, description, body, published date, and modification date
Metadata: Support for tags and categories for each post
Media: Image and file upload capabilities with automatic resizing options for images
Custom URLs: Ability to define custom slugs/URLs for each post
File Storage: All content stored in a structured file system rather than a database
Authentication & Authorization
Secure login system for content authors and administrators
Role-based permissions (Admin, Author, Editor)
JWT-based authentication for API access
Front End Features
Home page showing recent posts with pagination
Category-based listing pages with pagination
Tag-based filtering
Responsive design for mobile and desktop views
Search functionality across all posts
Publishing
XML publishing support (RSS/Atom feeds)
Scheduled publishing of posts
Draft/published status for posts
Technical Requirements
ASP.NET Core 10 Preview 4 Minimal API architecture
No database dependencies (file-based storage)
Markdown or HTML support for content editing
Optimized asset delivery (images, CSS, JS)
SEO-friendly URL structure
Technical Implementation
File Structure
/content
/posts
/YYYY-MM-DD-post-slug/
meta.json # Contains title, description, tags, categories, custom URL
content.md # Markdown content
/assets/ # Images and files specific to this post
/users
/username/
profile.json # User information and roles
/categories
category-name.json # Category metadata
/tags
tag-name.json # Tag metadata
/config
site.json # Site configuration
routes.json # Custom route mappings
Publishing Process
Author creates/edits post and saves as draft
Post can be published immediately or scheduled
System generates XML feeds automatically when posts are published
Custom URLs are validated during the publishing process# SK_BlogSystem
