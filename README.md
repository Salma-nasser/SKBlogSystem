# File-Based Blog System - Aether & Ink

A lightweight, file-based blogging system built with ASP.NET Core that stores content as files rather than in a database.

## How to Run

### Prerequisites
- .NET 8.0 SDK or later
- A modern web browser

### Installation & Setup
1. Clone the repository
2. Run `dotnet restore`
3. Run `dotnet run`
4. Open browser to `https://localhost:7189`

## Core Features

### Authentication & Authorization
- User registration with email validation and password strength requirements
- JWT token-based login system
- Role-based access control (Admin, Author, User)
- Admin panel for user management and promotion
- Secure session management

### Content Management
- Rich Markdown editor with live preview
- Blog post creation with title, description, tags, categories
- Custom SEO-friendly URLs
- Multiple image upload with preview
- Scheduled publishing and draft system
- File-based storage system

### Media Management
- Multi-image upload support
- Real-time image preview during creation
- Markdown integration for images
- Responsive image layouts (1-6+ images)
- Click-to-expand image modals
- Copy markdown functionality

### User Profile Management
- View own and other user profiles
- Profile editing (email, password, profile picture)
- Post management (published posts, drafts, scheduled)
- Post modification and deletion
- User statistics display

### Blog Reading Experience
- Responsive card-based post grid layout
- Pagination for multiple pages
- Real-time search across titles, descriptions, tags
- Tag and category filtering system
- Individual post view with full content
- Read more/less functionality for long posts

### Interactive Features
- Like/unlike post functionality
- View users who liked posts
- Social interaction with user avatars
- Modal dialogs for inline editing
- Confirmation dialogs for deletions

### User Interface
- Light/dark mode toggle with persistence
- Smooth animations and transitions
- Mobile-first responsive design
- Coffee/cream color palette theme
- Touch-friendly interface

### Search & Discovery
- Real-time search as you type
- Multi-field search (titles, descriptions, tags, categories)
- Clickable tags and categories for filtering
- Active filter visual indicators
- Clear filters functionality

### Publishing Features
- Draft, published, and scheduled content states
- Preview system before publishing
- Auto-save indicators
- Content validation
- URL generation

### Technical Features
- Minimal API architecture
- ES6 JavaScript modules
- File-based storage (no database)
- Image optimization and lazy loading
- Client-side caching
- Error handling with user feedback

## Project Structure
- Content/posts/ - Blog posts storage
- Content/users/ - User data storage
- Endpoints/ - API endpoint definitions
- Services/ - Business logic services
- wwwroot/ - Static web assets (HTML, CSS, JS)
- Models/ - Data models

## Key Technologies
- Backend: ASP.NET Core Minimal API
- Frontend: Vanilla JavaScript ES6+ modules
- Styling: CSS3 with custom properties
- Authentication: JWT tokens
- Content: Markdown with live preview
- Storage: File
