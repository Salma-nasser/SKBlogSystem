using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Endpoints;

public static class AdminEndpoints
{
  public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapGet("/api/admin/users", [Authorize(Roles = "Admin")] async (IAdminService adminService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var result = await adminService.GetAllUsers();
      return result;
    });

    app.MapPut("/api/admin/users/promote/{username}", [Authorize(Roles = "Admin")] async (string username, IAdminService adminService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var result = await adminService.PromoteUserToAdmin(username, currentUser);
      return result;
    });

    // Check if user is admin for frontend authorization
    app.MapGet("/api/admin/check", [Authorize(Roles = "Admin")] (HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      return Results.Ok(new { isAdmin = true, username = currentUser });
    });
  }
}