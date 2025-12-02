import { HardDrive, RefreshCw, Server, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DriveUsageMap } from './drive-usage-map';

import type { DriveAnalysis, DriveMapping } from '@workspace/shared';

import { fetchDriveAnalysis } from '@/api/scripts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DriveMappingWithScript extends DriveMapping {
  scriptName: string;
}

export const DriveMappingsTab = () => {
  const [analysis, setAnalysis] = useState<DriveAnalysis | null>(null);
  const [allMappings, setAllMappings] = useState<DriveMappingWithScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrives, setSelectedDrives] = useState<Set<string>>(new Set());

  // Build usage count map from analysis data
  const usageCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!analysis) return map;
    
    // Count from conflicts (drives used by multiple scripts)
    for (const item of analysis.conflicts) {
      map.set(item.driveLetter, item.scripts.length);
    }
    
    // For drives used by single script, set count to 1
    for (const drive of analysis.usedDrives) {
      if (!map.has(drive)) {
        map.set(drive, 1);
      }
    }
    
    return map;
  }, [analysis]);

  // Count of drives shared by multiple scripts
  const sharedDrivesCount = useMemo(() => {
    return analysis?.conflicts.length ?? 0;
  }, [analysis]);

  // Filter mappings based on selected drives
  const filteredMappings = useMemo(() => {
    if (selectedDrives.size === 0) return allMappings;
    return allMappings.filter((m) => selectedDrives.has(m.driveLetter));
  }, [allMappings, selectedDrives]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch drive analysis
      const analysisResponse = await fetchDriveAnalysis();

      setAnalysis(analysisResponse.analysis);

      // Create mapping list from driveUsage (all drives, not just conflicts)
      const mappings: DriveMappingWithScript[] = [];
      let idx = 0;
      
      // Use driveUsage which contains ALL drive mappings (including single-script drives)
      const driveUsageData = analysisResponse.analysis.driveUsage ?? analysisResponse.analysis.conflicts;
      
      for (const usage of driveUsageData) {
        for (const script of usage.scripts) {
          mappings.push({
            id: `${usage.driveLetter}-${script.scriptId}-${idx++}`,
            scriptId: script.scriptId,
            scriptName: script.scriptName,
            driveLetter: usage.driveLetter,
            networkPath: script.networkPath,
            hasCredentials: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      setAllMappings(mappings);
    } catch (err) {
      console.error('Failed to load drive analysis:', err);
      setError('Failed to load drive analysis data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <HardDrive className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Data</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Overview of all network drive mappings across your scripts
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scripts</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.totalScripts}</div>
            <p className="text-xs text-muted-foreground">with drive mappings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.totalMappings}</div>
            <p className="text-xs text-muted-foreground">drive letters mapped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drives In Use</CardTitle>
            <HardDrive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.usedDrives.length}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.usedDrives.slice(0, 5).join(', ')}
              {analysis.usedDrives.length > 5 && '...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Drives</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sharedDrivesCount}</div>
            <p className="text-xs text-muted-foreground">
              {sharedDrivesCount === 0
                ? 'No shared drive letters'
                : `${sharedDrivesCount} drive${sharedDrivesCount > 1 ? 's' : ''} used by multiple scripts`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Drive Usage Map */}
      <DriveUsageMap
        usedDrives={analysis.usedDrives}
        availableDrives={analysis.availableDrives}
        usageCount={usageCountMap}
        selectedDrives={selectedDrives}
        onSelectionChange={setSelectedDrives}
      />

      {/* Mappings Table - Show all drive usage details */}
      {allMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Drive Usage Details
              {selectedDrives.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (filtered by: {Array.from(selectedDrives).sort().join(', ')})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {selectedDrives.size > 0
                ? `Showing ${filteredMappings.length} mapping${filteredMappings.length !== 1 ? 's' : ''} for selected drive${selectedDrives.size > 1 ? 's' : ''}`
                : 'All drive letter mappings with their network paths. Click on drive letters above to filter.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMappings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Drive</TableHead>
                    <TableHead>Script</TableHead>
                    <TableHead>Network Path</TableHead>
                    <TableHead className="w-32">Usage Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => {
                    const usageCount = usageCountMap.get(mapping.driveLetter) ?? 1;
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <Badge
                            variant={usageCount > 1 ? 'default' : 'secondary'}
                            className="font-mono"
                          >
                            {mapping.driveLetter}:
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {mapping.scriptName}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {mapping.networkPath}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Users className="mr-1 h-3 w-3" />
                            {usageCount} script{usageCount > 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HardDrive className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No mappings found for the selected drive{selectedDrives.size > 1 ? 's' : ''}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state for no mappings */}
      {analysis.totalMappings === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Drive Mappings Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No drive mappings have been detected in your scripts yet.
              Add scripts with network drive mappings to see them here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
