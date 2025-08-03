{pkgs}: {
  channel = "stable-24.05";
  
    # Sets environment variables in the workspace
  env = {
    DATABASE_URL="postgresql://postgres.efnovsfkcayvhhwiesbv:8QMvhKWbpX%23D6Wz@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    SUPABASE_URL="https://onlqthyoezqvcoxjlwal.supabase.co";
    SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubHF0aHlvZXpxdmNveGpsd2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAyMDM3NiwiZXhwIjoyMDY4NTk2Mzc2fQ.TiZo2aQEEUwr-W-9BZCFe7AFhVWO3lqT9kW3YmD3A04";

  };

  
  
  packages = [
    pkgs.nodejs_20
  ];
  idx.extensions = [
    "svelte.svelte-vscode"
    "vue.volar"
  ];
  idx.previews = {
    previews = {
      web = {
        command = [
          "npm"
          "run"
          "frontend:dev"
          "--"
          "--port"
          "$PORT"
          "--host"
          "0.0.0.0"
        ];
        manager = "web";
      };
    };
  };
}