using FileBlogSystem.Endpoints;
using FileBlogSystem.Services;
using FileBlogSystem.Models;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Routing.Tree;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<UserService>();
builder.Services.Configure<JsonOptions>(options =>
{
  options.SerializerOptions.PropertyNamingPolicy = null; // Disable camelCase naming
  options.SerializerOptions.WriteIndented = true;
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
    // JwtService will be resolved from the DI container in a scoped context
    var serviceProvider = builder.Services.BuildServiceProvider();
    var jwtService = serviceProvider.GetRequiredService<JwtService>();
    options.TokenValidationParameters = jwtService.GetTokenValidationParameters();
  });
builder.Services.AddAuthorization();
var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

app.MapPostsEndpoints();
app.MapPost("/api/auth/login", async (LoginRequest request, UserService userService) =>
{
  return await userService.LoginUser(request.Username, request.Password);
})
.AllowAnonymous()
.WithName("Login")
.WithTags("Authentication");

app.MapPost("/api/auth/register", async (RegisterRequest request, UserService userService) =>
{
  return await userService.RegisterUser(
      request.Username,
      request.Password,
      request.Email);
})
.AllowAnonymous()
.WithName("Register")
.WithTags("Authentication");

app.MapGet("/api/users/{username}", async (string username, UserService userService) =>
{
  return await userService.GetUserProfile(username);
})
.RequireAuthorization()
.WithName("GetUserProfile")
.WithTags("Users");

app.Run();
