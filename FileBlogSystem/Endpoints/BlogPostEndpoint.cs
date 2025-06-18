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

    app.MapPost("/api/posts/create", [Authorize] (CreatePostRequest request, HttpContext ctx, BlogPostService service) =>
    {
      // Example JWT-based user retrieval (adapt this to your auth setup)
      var userName = ctx.User.Identity?.Name;
      var email = ctx.User.FindFirst(ClaimTypes.Email)?.Value;
      var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;

      if (string.IsNullOrEmpty(userName))
        return Results.Unauthorized();

      var user = new User { Username = userName, Email = email ?? "", Role = role ?? "" };

      service.CreatePost(request, user);
      return Results.Created($"/api/posts/{request.CustomUrl}", null);
    });

    app.MapPut("/api/posts/modify/{slug}", [Authorize] (string slug, CreatePostRequest request, HttpContext ctx, BlogPostService service) =>
    {
      var userName = ctx.User.Identity?.Name;
      var email = ctx.User.FindFirst(ClaimTypes.Email)?.Value;
      var role = ctx.User.FindFirst(ClaimTypes.Role)?.Value;
      if (string.IsNullOrEmpty(userName))
        return Results.Unauthorized();

      var user = new User { Username = userName, Email = email ?? "", Role = role ?? "" };

      if (service.ModifyPost(slug, request, user, out var message))
        return Results.Ok(new { message });

      return Results.BadRequest(new { message });
    });
  }
}