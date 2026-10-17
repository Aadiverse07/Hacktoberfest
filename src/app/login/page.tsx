import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md p-10">
      <h1 className="text-xl font-semibold">Sign in from the Tradetide home page</h1>
      <p className="mt-2 text-sm text-slate-500">Use the account controls on the home page. Connect your backend to replace the local demo authentication.</p>
      <Link className="mt-5 inline-block underline" href="/">Return to Tradetide</Link>
    </main>
  );
}
