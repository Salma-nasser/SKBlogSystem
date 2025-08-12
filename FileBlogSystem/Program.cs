using FileBlogSystem.Endpoints;
using FileBlogSystem.Hubs;
using FileBlogSystem.Services;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Rewrite;
using SixLabors.ImageSharp.Web.Middleware;
using SixLabors.ImageSharp.Web.DependencyInjection;
using System.IO;
using Microsoft.AspNetCore.DataProtection;

// Create builder
var builder = WebApplication.CreateBuilder(args);
// Configure host to ignore background service exceptions
builder.Host.ConfigureServices((ctx, services) =>
{
  services.Configure<HostOptions>(options =>
  {
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
  });
});

// Read PORT from environment for deployment (e.g., Render)
var port = Environment.GetEnvironmentVariable("PORT") ?? "7189";
// Listen on HTTP only in container to avoid missing HTTPS cert
builder.WebHost.UseUrls($"http://*:{port}");

// Persist data protection keys in project directory to survive container restarts
var keysPath = Path.Combine(builder.Environment.ContentRootPath, "DataProtection-Keys");
Directory.CreateDirectory(keysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keysPath))
    .SetApplicationName("FileBlogSystem");

// JSON
builder.Services.Configure<JsonOptions>(options =>
{
  options.SerializerOptions.PropertyNamingPolicy = null;
  options.SerializerOptions.WriteIndented = true;
});

// Services
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<IBlogPostService, BlogPostService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddHostedService<ScheduledPostPublisher>();
builder.Services.AddSingleton<NotificationService>();
builder.Services.AddSingleton<INotificationService>(sp => sp.GetRequiredService<NotificationService>());
builder.Services.AddSignalR();
builder.Services.AddImageSharp();
// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
      var jwtService = new JwtService(builder.Configuration);
      options.TokenValidationParameters = jwtService.GetTokenValidationParameters();
      // Allow SignalR to receive access token from query string
      options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
      {
        OnMessageReceived = context =>
        {
          var accessToken = context.Request.Query["access_token"];
          var path = context.HttpContext.Request.Path;
          // If the request is for our SignalR hub, read the token from the query string
          if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/notificationHub"))
          {
            context.Token = accessToken;
          }
          return System.Threading.Tasks.Task.CompletedTask;
        }
      };
    });

// CORS
builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowFrontend", policy =>
  {
    policy.WithOrigins("http://localhost:7189", "http://localhost:5500")
            .AllowAnyHeader()
            .AllowAnyMethod();
  });
});
//email
builder.Services.AddSingleton(new EmailService(
    smtpHost: "smtp.gmail.com",       // Or your provider
    smtpPort: 587,
    fromAddress: "atherandink@gmail.com",
    smtpUser: "atherandink@gmail.com",
    smtpPassword: "zkrh togr pzxm mbhl" // Gmail requires an App Password
));

builder.Services.AddAuthorization();
builder.Services.Configure<FormOptions>(options =>
{
  options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10MB limit
});

var app = builder.Build();

// URL Rewriting for kebab-case URLs
var rewriteOptions = new RewriteOptions()
    // Redirect any *.html requests to extensionless URLs
    .AddRedirect("^([^.]+)\\.html$", "$1", statusCode: 301)
    // Rewrite extensionless routes to serve corresponding .html files
    .AddRewrite("^$", "welcome.html", skipRemainingRules: true)
    .AddRewrite("^login/?$", "login.html", skipRemainingRules: true)
    .AddRewrite("^register/?$", "register.html", skipRemainingRules: true)
    .AddRewrite("^blog/?$", "blog.html", skipRemainingRules: true)
    .AddRewrite("^profile/([^/?]+)/?$", "myProfile.html", skipRemainingRules: true)
    .AddRewrite("^admin/?$", "admin.html", skipRemainingRules: true)
    .AddRewrite("^create-post/?$", "createPost.html", skipRemainingRules: true)
    // Dynamic post rendering via API, rewrite removed
    .AddRewrite("^modify-post/([^/?]+)/?$", "modifyPost.html?slug=$1", skipRemainingRules: true)
    .AddRewrite("^forgot-password/?$", "forgot-password.html", skipRemainingRules: true);

app.UseRewriter(rewriteOptions);

// Dynamic post page rendering with Open Graph metadata
app.MapGet("/post/{slug}", async (string slug, IBlogPostService service, HttpContext ctx, IWebHostEnvironment env) =>
{
  var post = service.GetPostBySlug(slug, ctx.User.Identity?.Name);
  if (post == null) return Results.NotFound();
  var templatePath = Path.Combine(env.WebRootPath, "post.html");
  var html = await File.ReadAllTextAsync(templatePath);
  var desc = post.Description ?? string.Empty;
  var url = $"{ctx.Request.Scheme}://{ctx.Request.Host}/post/{slug}";
  html = html.Replace("%POST_TITLE%", post.Title)
             .Replace("%POST_DESC%", desc)
             .Replace("%POST_URL%", url)
             .Replace("%POST_AUTHOR%", post.Author);
  return Results.Content(html, "text/html");
});
// Static Files for wwwroot
app.UseDefaultFiles(new DefaultFilesOptions
{
  DefaultFileNames = { "welcome.html" }
});
app.UseStaticFiles();

// Static Files for posts
app.UseStaticFiles(new StaticFileOptions
{
  FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Content")),
  RequestPath = "/Content"
});
app.UseImageSharp();
app.UseRouting();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Map API endpoints
app.MapBlogPostEndpoints();
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapAdminEndpoints();
// routes for comments disabled
// app.MapCommentsEndpoints();
app.MapHub<NotificationHub>("/notificationHub");

// Only in development, open browser
if (app.Environment.IsDevelopment())
{
  app.UseHttpsRedirection();
  var url = "http://localhost:7189";
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