using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Endpoints;

public static class AdminEndpoints
{
  public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapPut("/api/users/promote/{username}", [Authorize(Roles = "Admin")] async (string username, IAdminService adminService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var result = await adminService.PromoteUserToAdmin(username, currentUser);
      return result;
    });
  }
}