import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Facility</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Facility name, logo, address, and license key management coming next.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Security</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Change password, 2FA, and data retention policy coming next.
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
