using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Xml.Linq;
using FileBlogSystem.Services;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.RateLimiting;
namespace FileBlogSystem.Endpoints;

[EnableRateLimiting("Fixed")]
public static class BlogPostEndpoints
{
    // Validation patterns
    private const string SlugPattern = @"^[a-z0-9\-]+$";
    private const string CategoryPattern = @"^[\w\s\-]{1,50}$";
    private const string TagPattern = @"^[\w\s\-]{1,50}$";
    private const string UsernamePattern = @"^[a-zA-Z0-9_]{3,20}$";
    private static bool IsValidSlug(string s) => Regex.IsMatch(s ?? string.Empty, SlugPattern);
    private static bool IsValidCategory(string s) => Regex.IsMatch(s ?? string.Empty, CategoryPattern);
    private static bool IsValidTag(string s) => Regex.IsMatch(s ?? string.Empty, TagPattern);
    private static bool IsValidUsername(string u) => Regex.IsMatch(u ?? string.Empty, UsernamePattern);
    public static void MapBlogPostEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/posts/published", GetPublishedPostsAsync);
        app.MapGet("/api/posts", GetPostsAsync);
        app.MapGet("/api/posts/category/{category}", GetPostsByCategoryAsync);
        app.MapGet("/api/posts/tag/{tag}", GetPostsByTagAsync);
        app.MapGet("/api/posts/{slug}", GetPostBySlugAsync);
        app.MapGet("/api/posts/drafts", GetDraftPostsAsync);
        app.MapPost("/api/posts/create", CreatePostAsync);
        app.MapPut("/api/posts/modify/{slug}", ModifyPostAsync);
        app.MapPut("/api/posts/publish/{slug}", PublishPostAsync);
        app.MapDelete("/api/posts/{slug}", DeletePostAsync);
        app.MapGet("/feed.xml", GetRssFeedAsync);
        app.MapGet("/api/posts/user", GetUserPostsAsync);
        app.MapGet("/api/posts/user/{username}", GetPostsByUserAsync);
        app.MapDelete("/api/posts/delete/{slug}", DeleteUserPostAsync);
        app.MapPost("/api/posts/{slug}/like", LikePostAsync)
            .WithName("LikePost")
            .WithTags("BlogPosts");
        app.MapDelete("/api/posts/{slug}/like", UnlikePostAsync);
        app.MapGet("/api/posts/{slug}/likes", GetPostLikesAsync);
        app.MapGet("/api/search", SearchPostsAsync);
        app.MapGet("/api/posts/{slug}/assets/{filename}", GetPostAssetAsync);
    }

    // Endpoint implementations
    private static IResult GetPublishedPostsAsync(IBlogPostService service)
    {
        return Results.Ok(service.GetAllPosts());
    }

    [Authorize]
    private static IResult GetPostsAsync(IBlogPostService service, HttpContext ctx)
    {
        var currentUsername = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(currentUsername))
            return Results.Unauthorized();
        return Results.Ok(service.GetAllPosts(currentUsername));
    }

    [Authorize]
    private static IResult GetPostsByCategoryAsync(string category, IBlogPostService service, HttpContext ctx)
    {
        if (!IsValidCategory(category))
            return Results.BadRequest(new { message = "Invalid category parameter." });
        var currentUsername = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(currentUsername))
            return Results.Unauthorized();
        return Results.Ok(service.GetPostsByCategory(category, currentUsername));
    }

    [Authorize]
    private static IResult GetPostsByTagAsync(string tag, IBlogPostService service, HttpContext ctx)
    {
        if (!IsValidTag(tag))
            return Results.BadRequest(new { message = "Invalid tag parameter." });
        var currentUsername = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(currentUsername))
            return Results.Unauthorized();
        return Results.Ok(service.GetPostsByTag(tag, currentUsername));
    }

    private static IResult GetPostBySlugAsync(string slug, IBlogPostService service, HttpContext ctx)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var currentUsername = ctx.User.Identity?.Name;
        var post = service.GetPostBySlug(slug, currentUsername);
        return post != null
            ? Results.Ok(post)
            : Results.NotFound(new { message = "Post not found." });
    }

    [Authorize]
    private static IResult GetDraftPostsAsync(HttpContext ctx, IBlogPostService service)
    {
        var userName = ctx.User.Identity?.Name;

        if (string.IsNullOrEmpty(userName))
            return Results.Unauthorized();

        var drafts = service.GetUserDrafts(userName);
        return Results.Ok(drafts);
    }

    [Authorize]
    private static async Task<IResult> CreatePostAsync(HttpContext ctx, IBlogPostService service, ISearchService search)
    {
        var userName = ctx.User.Identity?.Name;
        if (!ctx.Request.HasFormContentType)
        {
            Console.WriteLine("Request does not have form content type.");
            return Results.BadRequest(new { message = "Request must be multipart/form-data." });
        }
        if (string.IsNullOrEmpty(userName))
            return Results.Unauthorized();

        var parseResult = await ParseFormRequest(ctx, allowSchedule: true);
        if (parseResult.IsInvalid || parseResult.Request == null)
            return Results.BadRequest(new { message = parseResult.ErrorMessage });

        var result = await service.CreatePostAsync(parseResult.Request, userName);
        // If creation failed, don't attempt to access Slug on the dynamic object
        if (result is null || (result.Success is bool s && !s))
        {
            return Results.BadRequest(result ?? new { Message = "Failed to create post" });
        }

        // Refresh index after creating a post
        search.RebuildIndex(service.GetAllPosts());

        return Results.Created($"/api/posts/{result.Slug}", result);
    }

    [Authorize]
    private static async Task<IResult> ModifyPostAsync(string slug, HttpContext ctx, IBlogPostService service, ISearchService search)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var userName = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(userName))
            return Results.Unauthorized();

        var parseResult = await ParseFormRequest(ctx, allowSchedule: true);
        if (parseResult.IsInvalid || parseResult.Request == null)
            return Results.BadRequest(new { message = parseResult.ErrorMessage });

        var (success, message) = await service.ModifyPostAsync(slug, parseResult.Request, userName);

        if (success)
        {
            search.RebuildIndex(service.GetAllPosts());
            return Results.Ok(new { message });
        }
        return Results.BadRequest(new { message });
    }

    [Authorize]
    private static async Task<IResult> PublishPostAsync(string slug, HttpContext ctx, IBlogPostService service, ISearchService search)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var username = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Results.Unauthorized();

        var (success, message) = await service.PublishPostAsync(slug, username);

        if (success)
        {
            search.RebuildIndex(service.GetAllPosts());
            return Results.Ok(new { message });
        }
        return Results.BadRequest(new { message });
    }

    [Authorize(Roles = "Admin")]
    private static async Task<IResult> DeletePostAsync(string slug, IBlogPostService service, ISearchService search)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var deleted = await service.DeletePostAsync(slug);
        if (deleted)
        {
            search.RebuildIndex(service.GetAllPosts());
            return Results.Ok(new { message = "Post deleted successfully." });
        }
        return Results.NotFound(new { message = "Post not found." });
    }

    private static IResult GetRssFeedAsync(IBlogPostService blogService)
    {
        var posts = blogService.GetAllPosts(); // Fetch all published posts from your database

        var rss = new XDocument(
            new XElement("rss", new XAttribute("version", "2.0"),
                new XElement("channel",
                    new XElement("title", "My Blog"),
                    new XElement("link", "https://localhost:7189"),
                    new XElement("description", "Latest posts from My Blog"),
                    posts.Select(post =>
                        new XElement("item",
                            new XElement("title", post.Title),
                            new XElement("link", $"https://localhost:7189/blog.html?id={post.Slug}"),
                            new XElement("description", post.Body.Length > 100 ? post.Body.Substring(0, 100) + "..." : post.Body),
                            new XElement("pubDate", post.PublishedDate.ToUniversalTime().ToString("r"))
                        )
                    )
                )
            )
        );

        return Results.Content(rss.ToString(), "application/rss+xml");
    }

    [Authorize]
    private static IResult GetUserPostsAsync(HttpContext ctx, IBlogPostService service)
    {
        var username = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Results.Unauthorized();

        var posts = service.GetPostsByUser(username);
        return Results.Ok(posts);
    }

    [Authorize]
    private static IResult GetPostsByUserAsync(string username, HttpContext ctx, IBlogPostService service)
    {
        if (!IsValidUsername(username))
            return Results.BadRequest(new { message = "Invalid username parameter." });
        var currentUsername = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(currentUsername))
            return Results.Unauthorized();
        var posts = service.GetPostsByUser(username, currentUsername);
        return Results.Ok(posts);
    }

    [Authorize]
    private static async Task<IResult> DeleteUserPostAsync(string slug, HttpContext ctx, IBlogPostService service, ISearchService search)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var username = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Results.Unauthorized();
        var deleted = await service.DeletePostAsync(slug);
        if (deleted)
        {
            search.RebuildIndex(service.GetAllPosts());
            return Results.Ok(new { message = "Post deleted successfully." });
        }
        return Results.NotFound(new { message = "Post not found." });
    }

    [Authorize]
    private static IResult LikePostAsync(string slug, HttpContext ctx, IBlogPostService service, NotificationService notificationService)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var userName = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(userName))
            return Results.Unauthorized();

        return service.LikePost(slug, userName, notificationService);
    }

    [Authorize]
    private static IResult UnlikePostAsync(string slug, HttpContext ctx, IBlogPostService service)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        var userName = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(userName))
            return Results.Unauthorized();

        return service.UnlikePost(slug, userName);
    }

    [Authorize]
    private static IResult GetPostLikesAsync(string slug, IBlogPostService service)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });
        return service.GetPostLikes(slug);
    }

    [Authorize]
    private static IResult SearchPostsAsync(HttpContext ctx, ISearchService searchService, IBlogPostService blogService)
    {
        var username = ctx.User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Results.Unauthorized();

        var query = ctx.Request.Query["q"].ToString();
        var filterType = ctx.Request.Query["type"].ToString(); // tag | category
        var filterValue = ctx.Request.Query["value"].ToString();

        // Basic input constraints
        if (query?.Length > 200) query = query.Substring(0, 200);
        if (!string.IsNullOrEmpty(filterType) && filterType != "tag" && filterType != "category")
        {
            return Results.BadRequest(new { message = "Invalid filter type." });
        }

        var hits = searchService.Search(query ?? string.Empty, filterType, filterValue);
        // Retrieve posts by slug preserving order by score
        var postsBySlug = hits
            .Select(h => blogService.GetPostBySlug(h.Slug, username))
            .Where(p => p != null)
            .ToList();

        return Results.Ok(postsBySlug);
    }
    private static async Task<ParseResult> ParseFormRequest(HttpContext ctx, bool allowSchedule)
    {
        var form = await ctx.Request.ReadFormAsync();

        var title = form["Title"].ToString().Trim();
        var description = form["Description"].ToString().Trim();
        var body = form["Body"].ToString().Trim();
        var customUrl = form["CustomUrl"].ToString().Trim();
        var isPublished = bool.TryParse(form["IsPublished"], out var published) && published;

        if (string.IsNullOrEmpty(title))
            return ParseResult.Invalid("Title is required.");

        if (string.IsNullOrEmpty(description))
            return ParseResult.Invalid("Description is required.");

        if (string.IsNullOrEmpty(body))
            return ParseResult.Invalid("Body is required.");

        DateTime? scheduledDate = null;
        if (allowSchedule)
            scheduledDate = DateTime.TryParse(form["ScheduledDate"], out var parsedDate) ? parsedDate : (DateTime?)null;

        var tags = form["Tags"].ToString()
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();

        var categories = form["Categories"].ToString()
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();

        var images = form.Files.Where(f => f.Name == "Images").ToList();

        // Add support for KeptImages
        var keptImages = form["KeptImages"].Where(s => !string.IsNullOrEmpty(s)).Select(s => s!).ToList();

        var request = new CreatePostRequest
        {
            Title = title,
            Description = description,
            Body = body,
            CustomUrl = customUrl,
            IsPublished = isPublished,
            ScheduledDate = scheduledDate,
            Tags = tags,
            Categories = categories,
            Images = images,
            KeptImages = keptImages // Add this line
        };

        return ParseResult.Valid(request);
    }

    private record ParseResult(bool IsInvalid, string ErrorMessage, CreatePostRequest? Request)
    {
        public static ParseResult Invalid(string message) => new(true, message, null);
        public static ParseResult Valid(CreatePostRequest request) => new(false, string.Empty, request);
    }

    // Secure endpoint to serve only post assets
    private static async Task<IResult> GetPostAssetAsync(string slug, string filename, IWebHostEnvironment env, IBlogPostService service)
    {
        if (!IsValidSlug(slug))
            return Results.BadRequest(new { message = "Invalid post identifier." });

        // Verify the post exists
        var post = service.GetPostBySlug(slug, null);
        if (post == null)
            return Results.NotFound();

        // Sanitize filename to prevent directory traversal
        var sanitizedFilename = Path.GetFileName(filename);
        if (string.IsNullOrEmpty(sanitizedFilename) || sanitizedFilename != filename)
            return Results.BadRequest(new { message = "Invalid filename." });

        // Only allow image file extensions
        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var extension = Path.GetExtension(sanitizedFilename).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
            return Results.BadRequest(new { message = "File type not allowed." });

        // Build the secure path
        var contentPath = Path.Combine(env.ContentRootPath, "Content", "posts");

        // Find the post directory (it might have a date prefix)
        var postDirectory = Directory.GetDirectories(contentPath)
            .FirstOrDefault(dir => Path.GetFileName(dir).EndsWith($"-{slug}"));

        if (postDirectory == null)
            return Results.NotFound();

        var assetPath = Path.Combine(postDirectory, "assets", sanitizedFilename);

        if (!File.Exists(assetPath))
            return Results.NotFound();

        // Get MIME type
        var mimeType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "application/octet-stream"
        };

        var fileBytes = await File.ReadAllBytesAsync(assetPath);
        return Results.File(fileBytes, mimeType);
    }
}
