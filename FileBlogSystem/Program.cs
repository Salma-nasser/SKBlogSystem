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


var builder = WebApplication.CreateBuilder(args);

// Read PORT from environment for deployment (e.g., Render)
var port = Environment.GetEnvironmentVariable("PORT") ?? "7189";
builder.WebHost.UseUrls($"https://*:{port}");

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
builder.Services.AddScoped<ICommentService, CommentService>();
builder.Services.AddScoped<INotificationService>(sp => sp.GetRequiredService<NotificationService>()); // Forward interface requests to the concrete implementation
builder.Services.AddSignalR();
builder.Services.AddImageSharp();
// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
      var jwtService = new JwtService(builder.Configuration);
      options.TokenValidationParameters = jwtService.GetTokenValidationParameters();
    });

// CORS
builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowFrontend", policy =>
  {
    policy.WithOrigins("https://localhost:7189", "http://localhost:5500")
            .AllowAnyHeader()
            .AllowAnyMethod();
  });
});
//email
builder.Services.AddSingleton(new EmailService(
    smtpHost: "smtp.gmail.com",       // Or your provider
    smtpPort: 587,
    fromAddress: "salma.naser1020@gmail.com",
    smtpUser: "salma.naser1020@gmail.com",
    smtpPassword: "msqo gsmd tezi vznp" // Gmail requires an App Password
));

builder.Services.AddAuthorization();
builder.Services.Configure<FormOptions>(options =>
{
  options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10MB limit
});

var app = builder.Build();

// URL Rewriting for kebab-case URLs
var rewriteOptions = new RewriteOptions()
    .AddRewrite("^$", "welcome.html", skipRemainingRules: true)
    .AddRewrite("^login/?$", "login.html", skipRemainingRules: true)
    .AddRewrite("^register/?$", "register.html", skipRemainingRules: true)
    .AddRewrite("^blog/?$", "blog.html", skipRemainingRules: true)
    .AddRewrite("^profile/([^/?]+)/?$", "myProfile.html", skipRemainingRules: true)
    .AddRewrite("^admin/?$", "admin.html", skipRemainingRules: true)
    .AddRewrite("^create-post/?$", "createPost.html", skipRemainingRules: true)
    .AddRewrite("^post/([^/?]+)/?$", "post.html?slug=$1", skipRemainingRules: true)
    .AddRewrite("^modify-post/([^/?]+)/?$", "modifyPost.html?slug=$1", skipRemainingRules: true)
    .AddRewrite("^forgot-password/?$", "forgot-password.html", skipRemainingRules: true);

app.UseRewriter(rewriteOptions);

// Pipeline
app.UseHttpsRedirection();

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
app.MapCommentsEndpoints();
app.MapHub<NotificationHub>("/notificationHub");

// Only in development, open browser
if (app.Environment.IsDevelopment())
{
  var url = "https://localhost:7189";
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