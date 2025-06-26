using FileBlogSystem.Endpoints;
using FileBlogSystem.Models;
using FileBlogSystem.Middleware;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.FileProviders;
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
builder.Services.AddHostedService<ScheduledPostPublisher>();


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
builder.Services.AddRouting();

builder.Services.Configure<FormOptions>(options =>
{
  // Set up any form limits you need
  options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10MB limit for uploads
});

// Replace your existing antiforgery services with this
if (builder.Environment.IsDevelopment())
{
  // For development only - disable antiforgery
  builder.Services.AddAntiforgery(options => options.SuppressXFrameOptionsHeader = true);
}

var app = builder.Build();

//  Middleware pipeline
app.UseRouting();
app.UseCors("AllowFrontend");
app.UseMiddleware<JwtMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
  FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath,"Content", "posts")),
  RequestPath = "/Content/posts"
});



// Configure default files - this makes login.html a default document
var options = new DefaultFilesOptions();
options.DefaultFileNames.Clear();
options.DefaultFileNames.Add("login.html");
app.UseDefaultFiles(options);

// Redirect root to login explicitly (as a fallback)
app.MapGet("/", () => Results.Redirect("/login.html"));

//  Map endpoints
app.MapBlogPostEndpoints();

app.MapAuthEndpoints();

// Only in Development, open browser automatically
if (app.Environment.IsDevelopment())
{
  var url = "http://localhost:5000";
  try
  {
    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
    {
      FileName = url,
      UseShellExecute = true
    });
  }
  catch (Exception ex)
  {
    Console.WriteLine($"Failed to open browser: {ex.Message}");
  }
}

app.Run();