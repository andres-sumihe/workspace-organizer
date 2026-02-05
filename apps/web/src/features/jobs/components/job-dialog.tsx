import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ControlMTaskType } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCreateJob, useUpdateJob, useJobDetail, useJobFilters } from '@/hooks/use-jobs';

interface JobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null; // null = create mode, string = edit mode
  onSuccess?: () => void;
}

const TASK_TYPES: ControlMTaskType[] = ['Job', 'Dummy', 'Command', 'FileWatcher'];

export const JobDialog = ({ open, onOpenChange, jobId, onSuccess }: JobDialogProps) => {
  const isEditMode = !!jobId;
  
  // Form state
  const [formData, setFormData] = useState({
    jobName: '',
    description: '',
    application: '',
    groupName: '',
    nodeId: '',
    memName: '',
    memLib: '',
    owner: '',
    taskType: 'Job' as ControlMTaskType,
    isCyclic: false,
    isCritical: false,
    isActive: true,
    priority: '',
    daysCalendar: '',
    weeksCalendar: '',
    fromTime: '',
    toTime: ''
  });

  // Fetch job detail for edit mode
  const { data: jobDetailResponse, isLoading: loadingJob } = useJobDetail(isEditMode ? jobId : null);
  const jobDetail = jobDetailResponse?.job;

  // Fetch filter options for dropdowns
  const { data: filterOptions } = useJobFilters();

  // Mutations
  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Populate form when job data is loaded (edit mode)
  useEffect(() => {
    if (jobDetail && isEditMode) {
      setFormData({
        jobName: jobDetail.jobName || '',
        description: jobDetail.description || '',
        application: jobDetail.application || '',
        groupName: jobDetail.groupName || '',
        nodeId: jobDetail.nodeId || '',
        memName: jobDetail.memName || '',
        memLib: jobDetail.memLib || '',
        owner: jobDetail.owner || '',
        taskType: jobDetail.taskType || 'Job',
        isCyclic: jobDetail.isCyclic || false,
        isCritical: jobDetail.isCritical || false,
        isActive: jobDetail.isActive !== false,
        priority: jobDetail.priority || '',
        daysCalendar: jobDetail.daysCalendar || '',
        weeksCalendar: jobDetail.weeksCalendar || '',
        fromTime: jobDetail.fromTime || '',
        toTime: jobDetail.toTime || ''
      });
    }
  }, [jobDetail, isEditMode]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        jobName: '',
        description: '',
        application: '',
        groupName: '',
        nodeId: '',
        memName: '',
        memLib: '',
        owner: '',
        taskType: 'Job',
        isCyclic: false,
        isCritical: false,
        isActive: true,
        priority: '',
        daysCalendar: '',
        weeksCalendar: '',
        fromTime: '',
        toTime: ''
      });
    }
  }, [open]);

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (isEditMode && jobId) {
        await updateMutation.mutateAsync({
          jobId,
          payload: {
            jobName: formData.jobName,
            description: formData.description || undefined,
            memName: formData.memName || undefined,
            memLib: formData.memLib || undefined,
            owner: formData.owner || undefined,
            taskType: formData.taskType,
            isCyclic: formData.isCyclic,
            isCritical: formData.isCritical,
            isActive: formData.isActive,
            priority: formData.priority || undefined,
            daysCalendar: formData.daysCalendar || undefined,
            weeksCalendar: formData.weeksCalendar || undefined,
            fromTime: formData.fromTime || undefined,
            toTime: formData.toTime || undefined
          }
        });
      } else {
        await createMutation.mutateAsync({
          jobName: formData.jobName,
          application: formData.application,
          groupName: formData.groupName,
          nodeId: formData.nodeId,
          description: formData.description || undefined,
          memName: formData.memName || undefined,
          memLib: formData.memLib || undefined,
          owner: formData.owner || undefined,
          taskType: formData.taskType,
          isCyclic: formData.isCyclic,
          isCritical: formData.isCritical,
          isActive: formData.isActive,
          priority: formData.priority || undefined,
          daysCalendar: formData.daysCalendar || undefined,
          weeksCalendar: formData.weeksCalendar || undefined,
          fromTime: formData.fromTime || undefined,
          toTime: formData.toTime || undefined
        });
      }
      onSuccess?.();
    } catch (err) {
      console.error('Failed to save job:', err);
    }
  };

  const isValid = formData.jobName.trim() !== '' &&
    (isEditMode || (formData.application.trim() !== '' && formData.groupName.trim() !== '' && formData.nodeId.trim() !== ''));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Job' : 'New Job'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update job properties. Application, Group, and Node cannot be changed.'
              : 'Create a new Control-M job manually.'}
          </DialogDescription>
        </DialogHeader>

        {loadingJob && isEditMode ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Required Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="jobName">Job Name *</Label>
                <Input
                  id="jobName"
                  value={formData.jobName}
                  onChange={(e) => handleChange('jobName', e.target.value)}
                  placeholder="Enter job name"
                />
              </div>

              {!isEditMode && (
                <>
                  <div>
                    <Label htmlFor="application">Application *</Label>
                    <Input
                      id="application"
                      value={formData.application}
                      onChange={(e) => handleChange('application', e.target.value)}
                      placeholder="e.g., APP001"
                      list="applications-list"
                    />
                    {filterOptions?.applications && (
                      <datalist id="applications-list">
                        {filterOptions.applications.map((app) => (
                          <option key={app} value={app} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="groupName">Group *</Label>
                    <Input
                      id="groupName"
                      value={formData.groupName}
                      onChange={(e) => handleChange('groupName', e.target.value)}
                      placeholder="e.g., GROUP01"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="nodeId">Node/Server *</Label>
                    <Input
                      id="nodeId"
                      value={formData.nodeId}
                      onChange={(e) => handleChange('nodeId', e.target.value)}
                      placeholder="e.g., SERVER01"
                      list="nodes-list"
                    />
                    {filterOptions?.nodes && (
                      <datalist id="nodes-list">
                        {filterOptions.nodes.map((node) => (
                          <option key={node} value={node} />
                        ))}
                      </datalist>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Job description"
                rows={2}
              />
            </div>

            {/* Script Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="memName">Script Name (memName)</Label>
                <Input
                  id="memName"
                  value={formData.memName}
                  onChange={(e) => handleChange('memName', e.target.value)}
                  placeholder="e.g., script.bat"
                />
              </div>
              <div>
                <Label htmlFor="memLib">Script Directory (memLib)</Label>
                <Input
                  id="memLib"
                  value={formData.memLib}
                  onChange={(e) => handleChange('memLib', e.target.value)}
                  placeholder="e.g., /scripts"
                />
              </div>
            </div>

            {/* Task Type & Owner */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taskType">Task Type</Label>
                <Select
                  value={formData.taskType}
                  onValueChange={(value) => handleChange('taskType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="owner">Owner</Label>
                <Input
                  id="owner"
                  value={formData.owner}
                  onChange={(e) => handleChange('owner', e.target.value)}
                  placeholder="Owner name"
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromTime">From Time</Label>
                <Input
                  id="fromTime"
                  value={formData.fromTime}
                  onChange={(e) => handleChange('fromTime', e.target.value)}
                  placeholder="e.g., 0800"
                />
              </div>
              <div>
                <Label htmlFor="toTime">To Time</Label>
                <Input
                  id="toTime"
                  value={formData.toTime}
                  onChange={(e) => handleChange('toTime', e.target.value)}
                  placeholder="e.g., 1700"
                />
              </div>
              <div>
                <Label htmlFor="daysCalendar">Days Calendar</Label>
                <Input
                  id="daysCalendar"
                  value={formData.daysCalendar}
                  onChange={(e) => handleChange('daysCalendar', e.target.value)}
                  placeholder="Calendar name"
                />
              </div>
              <div>
                <Label htmlFor="weeksCalendar">Weeks Calendar</Label>
                <Input
                  id="weeksCalendar"
                  value={formData.weeksCalendar}
                  onChange={(e) => handleChange('weeksCalendar', e.target.value)}
                  placeholder="Calendar name"
                />
              </div>
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange('isActive', checked)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isCyclic"
                  checked={formData.isCyclic}
                  onCheckedChange={(checked) => handleChange('isCyclic', checked)}
                />
                <Label htmlFor="isCyclic" className="cursor-pointer">Cyclic</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isCritical"
                  checked={formData.isCritical}
                  onCheckedChange={(checked) => handleChange('isCritical', checked)}
                />
                <Label htmlFor="isCritical" className="cursor-pointer">Critical</Label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
