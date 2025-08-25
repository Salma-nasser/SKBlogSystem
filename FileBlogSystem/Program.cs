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
using Microsoft.AspNetCore.RateLimiting;

// Create builder
var builder = WebApplication.CreateBuilder(args);

// HSTS configuration
builder.Services.AddHsts(options =>
{
  options.Preload = true;
  options.IncludeSubDomains = true;
  options.MaxAge = TimeSpan.FromDays(365);
});

// Configure host to ignore background service exceptions
builder.Host.ConfigureServices((ctx, services) =>
{
  services.Configure<HostOptions>(options =>
  {
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
  });
});

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
builder.Services.AddSingleton<ISearchService, LuceneSearchService>();
builder.Services.AddSignalR();
builder.Services.AddImageSharp();

// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
      var jwtService = new JwtService(builder.Configuration);
      options.TokenValidationParameters = jwtService.GetTokenValidationParameters();
      // Allow SignalR to receive access token from query string
      options.Events = new JwtBearerEvents
      {
        OnMessageReceived = context =>
        {
          var accessToken = context.Request.Query["access_token"];
          var path = context.HttpContext.Request.Path;
          if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/notificationHub"))
          {
            context.Token = accessToken;
          }
          return Task.CompletedTask;
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

// RateLimiting
builder.Services.AddRateLimiter(RateLimiterOptions =>
{
  RateLimiterOptions.AddFixedWindowLimiter("Fixed", options =>
  {
    options.PermitLimit = 60;
    options.Window = TimeSpan.FromMinutes(1);
    options.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
    options.QueueLimit = 0;
  });
});

// Email
builder.Services.AddSingleton(new EmailService(
    smtpHost: "smtp.gmail.com",
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

// Only send HSTS in non-dev
if (!app.Environment.IsDevelopment())
{
  app.UseHsts();
}

// Redirect HTTP -> HTTPS
app.UseHttpsRedirection();

app.UseRateLimiter();

// Security headers (applies to all responses)
app.Use(async (context, next) =>
{
  context.Response.Headers["X-Content-Type-Options"] = "nosniff";
  context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
  context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  context.Response.Headers["Permissions-Policy"] =
      "geolocation=(), microphone=(), camera=(), payment=(), usb=(), fullscreen=(self)";

  // Allows your Google Fonts import, images, and WebSocket connections.
  context.Response.Headers["Content-Security-Policy"] =
  "default-src 'self'; " +
  "base-uri 'self'; frame-ancestors 'self'; form-action 'self'; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  // Allow Google Fonts CSS and jsDelivr for EasyMDE CSS
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
  // Be explicit for style elements as well
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
  // Allow scripts from jsDelivr (marked, EasyMDE) and cdnjs (DOMPurify, SignalR)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
  // Be explicit for script elements as well
  "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
  // API/Ajax and SignalR websockets
  "connect-src 'self' ws: wss:";

  await next();
});

// URL Rewriting for kebab-case URLs
var rewriteOptions = new RewriteOptions()
    // Redirect any *.html requests to extensionless URLs
    .AddRedirect("^([^.]+)\\.html$", "$1", statusCode: 301)
    // Rewrite extensionless routes to serve corresponding .html files
    .AddRewrite("^$", "welcome.html", skipRemainingRules: true)
    .AddRewrite("^login/?$", "login.html", skipRemainingRules: true)
    .AddRewrite("^register/?$", "register.html", skipRemainingRules: true)
    .AddRewrite("^blog/?$", "blog.html", skipRemainingRules: true)
    .AddRewrite("^privacy/?$", "privacy.html", skipRemainingRules: true)
    .AddRewrite("^terms/?$", "terms.html", skipRemainingRules: true)
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

app.UseImageSharp();

app.UseRouting();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Map endpoints
app.MapBlogPostEndpoints();
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapAdminEndpoints();
// app.MapCommentsEndpoints();
app.MapHub<NotificationHub>("/notificationHub");

// Build initial search index on startup
using (var scope = app.Services.CreateScope())
{
  var search = scope.ServiceProvider.GetRequiredService<ISearchService>();
  var posts = scope.ServiceProvider.GetRequiredService<IBlogPostService>().GetAllPosts();
  search.RebuildIndex(posts);
}


app.Run();

