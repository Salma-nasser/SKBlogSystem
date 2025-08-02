using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Endpoints;

public static class AdminEndpoints
{
  // Regex for valid usernames: 3-20 alphanumeric or underscore
  private const string UsernamePattern = "^[a-zA-Z0-9_]{3,20}$";
  private static bool IsValidUsername(string u) => Regex.IsMatch(u ?? string.Empty, UsernamePattern);
  public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapGet("/api/admin/users", [Authorize(Roles = "Admin")] async (IAdminService adminService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;
      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var users = await adminService.GetAllUsers();
      return Results.Ok(users);
    })
    .WithName("GetAllUsers");

    app.MapPut("/api/admin/users/promote/{username}", [Authorize(Roles = "Admin")] async (string username, IAdminService adminService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;
      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();
      if (!IsValidUsername(username))
        return Results.BadRequest(new { message = "Invalid username parameter." });

      var result = await adminService.PromoteUserToAdmin(username, currentUser);
      return result;
    })
    .WithName("PromoteUser");

    // Check if user is admin for frontend authorization
    app.MapGet("/api/admin/check", [Authorize(Roles = "Admin")] (HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;
      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      return Results.Ok(new { isAdmin = true, username = currentUser });
    })
    .WithName("CheckAdmin");
  }
}