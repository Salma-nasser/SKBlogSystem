using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.RateLimiting;
namespace FileBlogSystem.Endpoints;

[EnableRateLimiting("Fixed")]
public static class AdminEndpoints
{
  // Regex for valid usernames: 3-20 alphanumeric or underscore
  private const string UsernamePattern = "^[a-zA-Z0-9_]{3,20}$";
  private static bool IsValidUsername(string u) => Regex.IsMatch(u ?? string.Empty, UsernamePattern);

  public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
  {
    // Endpoint Definitions
    app.MapGet("/api/admin/users", GetAllUsersAsync)
          .RequireAuthorization(new AuthorizeAttribute { Roles = "Admin" })
          .WithName("GetAllUsers");

    app.MapPut("/api/admin/users/promote/{username}", PromoteUserToAdminAsync)
          .RequireAuthorization(new AuthorizeAttribute { Roles = "Admin" })
          .WithName("PromoteUser");

    app.MapGet("/api/admin/check", CheckAdminStatus)
          .RequireAuthorization(new AuthorizeAttribute { Roles = "Admin" })
      .WithName("CheckAdmin");
    // One-time backfill to compute PublishedPostsCount from existing posts
    app.MapPost("/api/admin/backfill-published-counts", BackfillPublishedCounts)
        .RequireAuthorization(new AuthorizeAttribute { Roles = "Admin" })
        .WithName("BackfillPublishedCounts");
  }
  private static async Task<IResult> GetAllUsersAsync(IAdminService adminService, HttpContext ctx)
  {
    var currentUser = ctx.User.Identity?.Name;
    if (string.IsNullOrEmpty(currentUser))
      return Results.Unauthorized();

    var users = await adminService.GetAllUsers();
    return Results.Ok(users);
  }

  private static async Task<IResult> PromoteUserToAdminAsync(string username, IAdminService adminService, HttpContext ctx)
  {
    var currentUser = ctx.User.Identity?.Name;
    if (string.IsNullOrEmpty(currentUser))
      return Results.Unauthorized();

    if (!IsValidUsername(username))
      return Results.BadRequest(new { message = "Invalid username parameter." });

    var result = await adminService.PromoteUserToAdmin(username, currentUser);
    return result;
  }
  private static IResult CheckAdminStatus(HttpContext ctx)
  {
    var currentUser = ctx.User.Identity?.Name;
    if (string.IsNullOrEmpty(currentUser))
      return Results.Unauthorized();

    return Results.Ok(new { isAdmin = true, username = currentUser });
  }

  private static async Task<IResult> BackfillPublishedCounts(IAdminService adminService, IBlogPostService blogService, HttpContext ctx)
  {
    var currentUser = ctx.User.Identity?.Name;
    if (string.IsNullOrEmpty(currentUser))
      return Results.Unauthorized();

    // Delegate to adminService for the actual backfill work
    var result = await ((dynamic)adminService).BackfillPublishedCounts(blogService);
    return result as IResult ?? Results.Problem("Backfill failed");
  }
}