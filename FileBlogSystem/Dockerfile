# Use .NET SDK image for building
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy all sources and publish
COPY . .

# Build and publish the app for net9.0 (restore happens implicitly)
RUN dotnet publish FileBlogSystem.csproj -c Release -o /app/publish -f net9.0

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Copy published output
COPY --from=build /app/publish .
# Copy frontend build into wwwroot
COPY wwwroot/ /app/wwwroot/


# Ensure Content subfolders for posts and users exist
RUN mkdir -p /app/Content/posts /app/Content/users

# Expose application ports
EXPOSE 80
ENV ASPNETCORE_URLS=http://+:80


# Declare volumes for persistent storage of posts and user data
VOLUME ["/app/Content/posts", "/app/Content/users"]

# Start the application
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
