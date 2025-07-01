using FileBlogSystem.Endpoints;
using FileBlogSystem.Services;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddHostedService<ScheduledPostPublisher>();

// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
      using var scope = builder.Services.BuildServiceProvider().CreateScope();
      var jwtService = scope.ServiceProvider.GetRequiredService<JwtService>();
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

builder.Services.AddAuthorization();
builder.Services.Configure<FormOptions>(options =>
{
  options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10MB limit
});

var app = builder.Build();

// Pipeline
app.UseHttpsRedirection();

// Static Files for wwwroot
app.UseDefaultFiles(new DefaultFilesOptions
{
  DefaultFileNames = { "login.html" }
});
app.UseStaticFiles();

// Static Files for posts
app.UseStaticFiles(new StaticFileOptions
{
  FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Content", "posts")),
  RequestPath = "/Content/posts"
});

app.UseRouting();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Map API endpoints
app.MapBlogPostEndpoints();
app.MapAuthEndpoints();

// Only in development, open browser
if (app.Environment.IsDevelopment())
{
  var url = "https://localhost:7189/login.html";
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