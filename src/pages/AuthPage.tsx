import { useSearchParams } from "react-router-dom";
import { AuthPage as AuthPageComponent } from "@/components/auth/AuthPage";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  
  return (
    <AuthPageComponent 
      initialMode={mode === 'login' ? 'login' : 'signup'}
    />
  );
}