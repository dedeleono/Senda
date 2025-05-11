import { useDepositStore } from '@/stores/use-deposit-store';
import { Button } from '@/components/ui/button';

export function ConfirmationView() {
  const { formData, submitDeposit, isSubmitting } = useDepositStore();

  const handleSubmit = async () => {
    try {
      await submitDeposit(async (input) => {
        const response = await fetch('/api/trpc/sendaRouter.startDeposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        return response.json().then(res => res.data);
      });
    } catch (error) {
      console.error('Failed to submit deposit:', error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Confirm Your Deposit</h2>
      
      <div className="space-y-2">
        <p>
          <span className="font-medium">Amount:</span> {formData.amount.value} {formData.amount.token}
        </p>
        <p>
          <span className="font-medium">Recipient:</span> {formData.recipient.email}
        </p>
        <p>
          <span className="font-medium">Authorization:</span> {formData.authorization}
        </p>
      </div>

      <Button 
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Processing...' : 'Confirm Deposit'}
      </Button>
    </div>
  );
} 