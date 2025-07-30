using FileBlogSystem.Interfaces;
using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity.Data;
namespace FileBlogSystem.Endpoints;

public static class UserEndpoints
{
  public static void MapUserEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapGet("/api/users/{username}", async (string username, IUserService userService, HttpContext ctx) =>
    {
      var requestingUser = ctx.User.Identity?.Name;
      return await userService.GetUserProfile(username, requestingUser);
    });

    app.MapPut("/api/users/{username}", [Authorize] async (
        string username,
        HttpContext context,
        IUserService userService,
        UpdateProfileRequest request) =>
    {
      var currentUser = context.User.Identity?.Name;
      if (currentUser == null || currentUser != username)
        return Results.Unauthorized();

      return await userService.UpdateUserProfile(username, request);
    })
    .RequireAuthorization()
    .WithName("UpdateUserProfile")
    .WithTags("Users");
    app.MapPatch("/api/users/delete/{username}", [Authorize] async (
        string username,
        HttpContext context,
        IUserService userService) =>
    {
      var currentUser = context.User.Identity?.Name;
      if (currentUser == null || currentUser != username)
        return Results.Unauthorized();
      return await userService.DeleteUser(username);
    })
    .RequireAuthorization()
    .WithName("DeleteUser");
    app.MapGet("/notifications", async (HttpContext ctx, NotificationService notificationService) =>
{
  var username = ctx.User.Identity?.Name;
  if (username == null) return Results.Unauthorized();

  // Check for ?all=true query parameter
  var allParam = ctx.Request.Query["all"].ToString();
  bool getAll = !string.IsNullOrEmpty(allParam) && allParam.ToLower() == "true";
  List<Notification> notifications;
  if (getAll)
    notifications = await notificationService.GetAllAsync(username);
  else
    notifications = await notificationService.GetUnreadAsync(username);
  return Results.Ok(notifications);
});

    app.MapPost("/notifications/read/{id:int}", async (int id, HttpContext ctx, NotificationService service) =>
    {
      var username = ctx.User.Identity?.Name;
      if (username == null) return Results.Unauthorized();

      await service.MarkAsReadAsync(username, id);
      return Results.Ok();
    });
    app.MapPost("/api/users/forgot-password", async (Models.ForgotPasswordRequest request, IUserService userService, EmailService emailService) =>
    {
      if (string.IsNullOrEmpty(request.Username))
        return Results.BadRequest("Username is required.");

      var result = await userService.ForgotPassword(request.Username, request.Email, emailService);
      return result;
    });
    app.MapPost("/api/users/verify-otp", async (Models.VerifyOtpRequest request, IUserService userService) =>
    {
      if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.OTPCode))
        return Results.BadRequest("Username and OTP code are required.");

      var result = await userService.VerifyOtp(request.Username, request.OTPCode);
      return result;
    });

    app.MapPost("/api/users/reset-password", async (Models.ResetPasswordRequest request, IUserService userService) =>
    {
      if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.NewPassword))
        return Results.BadRequest("Username and new password are required.");

      var result = await userService.ResetPassword(request.Username, request.NewPassword);
      return result;
    });
  }
}