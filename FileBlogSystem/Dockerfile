# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY FileBlogSystem.csproj .
RUN dotnet restore FileBlogSystem.csproj

# Copy everything else and publish
COPY . .
RUN dotnet publish FileBlogSystem.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

COPY --from=build /app/publish .
COPY wwwroot/ /app/wwwroot/

RUN mkdir -p /app/Content/posts /app/Content/users

EXPOSE 80
ENV ASPNETCORE_URLS=http://+:8080
VOLUME ["/app/Content/posts", "/app/Content/users"]

ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
