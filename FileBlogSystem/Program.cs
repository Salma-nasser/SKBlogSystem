using FileBlogSystem.Endpoints;
using FileBlogSystem.Models;
using FileBlogSystem.Middleware;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Configure JSON options
builder.Services.Configure<JsonOptions>(options =>
{
  options.SerializerOptions.PropertyNamingPolicy = null;
  options.SerializerOptions.WriteIndented = true;
});

//  Service registration
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<BlogPostService>();

//  Authentication setup
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
      using var scope = builder.Services.BuildServiceProvider().CreateScope();
      var jwtService = scope.ServiceProvider.GetRequiredService<JwtService>();
      options.TokenValidationParameters = jwtService.GetTokenValidationParameters();
    });

//  CORS policy
builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowFrontend", policy =>
  {
    policy.WithOrigins("http://localhost:5500", "http://127.0.0.1:5500")
            .AllowAnyHeader()
            .AllowAnyMethod();
  });
});

builder.Services.AddAuthorization();

var app = builder.Build();

//  Middleware pipeline
app.UseRouting();
app.UseCors("AllowFrontend");
app.UseMiddleware<JwtMiddleware>(); // Custom middleware (optional)
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();

//  Map endpoints
app.MapBlogPostEndpoints();

app.MapAuthEndpoints();

app.Run();