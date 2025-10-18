import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/card';
import { FormField } from '../components/ui/form-field';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const notificationSchema = z.object({
  timezone: z.string().min(1, 'Timezone required'),
  locale: z.enum(['en-AU', 'en-NZ', 'en-UK']),
  digestFrequency: z.enum(['Daily', 'Weekly', 'Monthly']),
  accessibilityMode: z.boolean()
});

type SettingsForm = z.infer<typeof notificationSchema>;

export function Settings() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SettingsForm>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      timezone: 'Australia/Sydney',
      locale: 'en-AU',
      digestFrequency: 'Daily',
      accessibilityMode: true
    }
  });

  const onSubmit = (values: SettingsForm) => {
    console.log('Settings saved', values);
  };

  return (
    <div className="container">
      <h2 className="section-title">Workspace settings</h2>
      <p className="muted">Configure defaults for notifications, locale, and accessibility.</p>

      <Card header={<h3>Notifications & locale</h3>}>
        <form className="form-grid two-columns" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField id="timezone" label="Timezone" error={errors.timezone?.message}>
            <Input id="timezone" {...register('timezone')} />
          </FormField>

          <FormField id="locale" label="Locale" error={errors.locale?.message}>
            <Select id="locale" {...register('locale')}>
              <option value="en-AU">English (Australia)</option>
              <option value="en-NZ">English (New Zealand)</option>
              <option value="en-UK">English (UK)</option>
            </Select>
          </FormField>

          <FormField id="digestFrequency" label="Digest frequency" error={errors.digestFrequency?.message}>
            <Select id="digestFrequency" {...register('digestFrequency')}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </Select>
          </FormField>

          <FormField id="accessibilityMode" label="Accessibility mode">
            <label className="toggle" htmlFor="accessibilityMode">
              <input id="accessibilityMode" type="checkbox" {...register('accessibilityMode')} />
              <span>Enable high-contrast UI</span>
            </label>
          </FormField>

          <div className="form-field" style={{ alignSelf: 'end' }}>
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
