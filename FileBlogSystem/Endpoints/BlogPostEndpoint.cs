using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
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

        app.MapPost("/api/posts/create", [Authorize] (CreatePostRequest request, HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            service.CreatePost(request, userName);
            return Results.Created($"/api/posts/{request.CustomUrl}", null);
        });

        app.MapPut("/api/posts/modify/{slug}", [Authorize] (string slug, CreatePostRequest request, HttpContext ctx, BlogPostService service) =>
        {
            var userName = ctx.User.Identity?.Name;

            if (string.IsNullOrEmpty(userName))
                return Results.Unauthorized();

            if (service.ModifyPost(slug, request, userName, out var message))
                return Results.Ok(new { message });

            return Results.BadRequest(new { message });
        });

        app.MapPut("/api/posts/publish/{slug}", [Authorize] (string slug, HttpContext ctx, BlogPostService service) =>
        {
            var username = ctx.User.Identity?.Name;
            if (username == null)
                return Results.Unauthorized();

            var success = service.PublishPost(slug, username, out var message);
            return success ? Results.Ok(new { message }) : Results.NotFound(new { message });
        });

    }
}
