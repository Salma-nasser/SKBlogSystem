using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FileBlogSystem.Endpoints;

public static class BlogPostEndpoints
{
    public static void MapBlogPostEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/posts", [Authorize] (BlogPostService service) =>
        {
            return Results.Ok(service.GetAllPosts());
        });

        app.MapGet("/api/posts/category/{category}", [Authorize] (string category, BlogPostService service) =>
        {
            return Results.Ok(service.GetPostsByCategory(category));
        });

        app.MapGet("/api/posts/tag/{tag}", [Authorize] (string tag, BlogPostService service) =>
        {
            return Results.Ok(service.GetPostsByTag(tag));
        });

        app.MapGet("/api/posts/{slug}", [Authorize] (string slug, BlogPostService service) =>
        {
            var post = service.GetPostBySlug(slug);
            return post != null ? Results.Ok(post) : Results.NotFound(new { message = "Post not found." });
        });

        app.MapGet("/api/posts/drafts", [Authorize] (HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var drafts = service.GetUserDrafts(userName);
            return Results.Ok(drafts);
        });

        app.MapPost("/api/posts/create", [Authorize] async (HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;
            if (!ctx.Request.HasFormContentType)
            {
                Console.WriteLine("Request does not have form content type.");
                return Results.BadRequest(new { message = "Request must be multipart/form-data." });
            }
            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var form = await ctx.Request.ReadFormAsync();

            var title = form["Title"].ToString();
            var description = form["Description"].ToString();
            var body = form["Body"].ToString();
            var customUrl = form["CustomUrl"].ToString();
            var isPublished = bool.TryParse(form["IsPublished"], out var published) && published;
            var scheduledDate = DateTime.TryParse(form["ScheduledDate"], out var parsedDate) ? parsedDate : (DateTime?)null;

            var tags = form["Tags"].Where(t => t != null).Select(t => t!).ToList();

            var categories = form["Categories"].Where(c => c != null).Select(c => c!).ToList();
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

            var result = await service.CreatePostAsync(request, userName);

            return Results.Created($"/api/posts/{result.Slug}", result);
        });

        app.MapPut("/api/posts/modify/{slug}", [Authorize] async (string slug, HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var form = await ctx.Request.ReadFormAsync();

            var title = form["Title"].ToString();
            var description = form["Description"].ToString();
            var body = form["Body"].ToString();
            var customUrl = form["CustomUrl"].ToString();
            var isPublished = bool.TryParse(form["IsPublished"], out var published) && published;
            var scheduledDate = DateTime.TryParse(form["ScheduledDate"], out var parsedDate) ? parsedDate : (DateTime?)null;

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

            var (success, message) = await service.ModifyPostAsync(slug, request, userName);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });

        app.MapPut("/api/posts/blog-modify/{slug}", [Authorize] async (string slug, HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            var form = await ctx.Request.ReadFormAsync();

            var title = form["Title"].ToString();
            var description = form["Description"].ToString();
            var body = form["Body"].ToString();
            var customUrl = form["CustomUrl"].ToString();

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
                IsPublished = true, // Always published
                ScheduledDate = null, // Always immediately published
                Tags = tags,
                Categories = categories,
                Images = images
            };

            var (success, message) = await service.ModifyPostAsync(slug, request, userName);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });


        app.MapPut("/api/posts/publish/{slug}", [Authorize] async (string slug, HttpContext ctx, BlogPostService service) =>
        {
            var username = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(username))
                return Results.Unauthorized();

            var (success, message) = await service.PublishPostAsync(slug, username);

            return success ? Results.Ok(new { message }) : Results.BadRequest(new { message });
        });
        app.MapDelete("/api/posts/{slug}", [Authorize(Roles = "Admin")] async (string slug, BlogPostService service) =>
        {
            var deleted = await service.DeletePostAsync(slug);
            return deleted ? Results.Ok(new { message = "Post deleted successfully." }) : Results.NotFound(new { message = "Post not found." });
        });

    }
}
