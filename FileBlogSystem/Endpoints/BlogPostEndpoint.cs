using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Xml.Linq;

namespace FileBlogSystem.Endpoints;

public static class BlogPostEndpoints
{
    public static void MapBlogPostEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/posts", [Authorize] (IBlogPostService service) =>
        {
            return Results.Ok(service.GetAllPosts());
        });

        app.MapGet("/api/posts/category/{category}", [Authorize] (string category, IBlogPostService service) =>
        {
            return Results.Ok(service.GetPostsByCategory(category));
        });

        app.MapGet("/api/posts/tag/{tag}", [Authorize] (string tag, IBlogPostService service) =>
        {
            return Results.Ok(service.GetPostsByTag(tag));
        });

        app.MapGet("/api/posts/{slug}", [Authorize] (string slug, IBlogPostService service) =>
        {
            var post = service.GetPostBySlug(slug);
            return post != null ? Results.Ok(post) : Results.NotFound(new { message = "Post not found." });
        });

        app.MapGet("/api/posts/drafts", [Authorize] (HttpContext ctx, IBlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var drafts = service.GetUserDrafts(userName);
            return Results.Ok(drafts);
        });

        app.MapPost("/api/posts/create", [Authorize] async (HttpContext ctx, IBlogPostService service) =>
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

            return Results.Created($"/api/posts/{result.Slug}", result);
        });

        app.MapPut("/api/posts/modify/{slug}", [Authorize] async (string slug, HttpContext ctx, IBlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var parseResult = await ParseFormRequest(ctx, allowSchedule: true);
            if (parseResult.IsInvalid || parseResult.Request == null)
                return Results.BadRequest(new { message = parseResult.ErrorMessage });

            var (success, message) = await service.ModifyPostAsync(slug, parseResult.Request, userName);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });

        app.MapPut("/api/posts/blog-modify/{slug}", [Authorize] async (string slug, HttpContext ctx, IBlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var parseResult = await ParseFormRequest(ctx, allowSchedule: false);
            if (parseResult.IsInvalid || parseResult.Request == null)
                return Results.BadRequest(new { message = parseResult.ErrorMessage });

            parseResult.Request.IsPublished = true;
            parseResult.Request.ScheduledDate = null;

            var (success, message) = await service.ModifyPostAsync(slug, parseResult.Request, userName);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });

        app.MapPut("/api/posts/publish/{slug}", [Authorize] async (string slug, HttpContext ctx, IBlogPostService service) =>
        {
            var username = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(username))
                return Results.Unauthorized();

            var (success, message) = await service.PublishPostAsync(slug, username);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });

        app.MapDelete("/api/posts/{slug}", [Authorize(Roles = "Admin")] async (string slug, IBlogPostService service) =>
        {
            var deleted = await service.DeletePostAsync(slug);
            return deleted ? Results.Ok(new { message = "Post deleted successfully." }) : Results.NotFound(new { message = "Post not found." });
        });

        app.MapGet("/feed.xml", (IBlogPostService blogService) =>
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
        });
        app.MapGet("/api/posts/user", [Authorize] (HttpContext ctx, IBlogPostService service) =>
        {
            var username = ctx.User.Identity?.Name;
            if (string.IsNullOrEmpty(username))
                return Results.Unauthorized();

            var posts = service.GetPostsByUser(username);
            return Results.Ok(posts);
        });

        app.MapDelete("/api/posts/delete/{slug}", [Authorize] async (string slug, HttpContext ctx, IBlogPostService service) =>
        {
            var username = ctx.User.Identity?.Name;
            if (string.IsNullOrEmpty(username))
                return Results.Unauthorized();

            var deleted = await service.DeletePostAsync(slug);
            return deleted ? Results.Ok(new { message = "Post deleted successfully." }) : Results.NotFound(new { message = "Post not found." });
        });

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
            Images = images
        };

        return ParseResult.Valid(request);
    }

    private record ParseResult(bool IsInvalid, string ErrorMessage, CreatePostRequest? Request)
    {
        public static ParseResult Invalid(string message) => new(true, message, null);
        public static ParseResult Valid(CreatePostRequest request) => new(false, string.Empty, request);
    }
}
