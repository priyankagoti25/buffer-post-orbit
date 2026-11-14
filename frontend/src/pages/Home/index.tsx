import { useSearchParams } from "react-router-dom";
import ContinueButton from "../../components/ContinueButton";
import Logo from "../../components/Logo";
import Notice from "../../components/Notice";

const REASONS: Record<string, string> = {
  access_denied: "You chose not to allow access in Buffer.",
  code_expired: "The sign-in took too long. Please try again.",
  invalid_state: "The sign-in link expired. Please try again.",
};

export default function Home() {
  const [params] = useSearchParams();
  const failed = params.get("buffer") === "error";
  const reason = params.get("reason") ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-10">
      <header className="pb-8">
        <Logo />
      </header>
      <div className="my-auto space-y-5">
        {failed && (
          <Notice kind="error">
            Buffer sign-in did not finish.{" "}
            {REASONS[reason] ?? "Please try again."}
          </Notice>
        )}
        <section className="grid overflow-hidden rounded-3xl sm:rounded-[1.75rem] md:grid-cols-5">
          <div className="bg-sage-300 p-6 sm:p-12 md:col-span-3">
            {/* <p className="label-eyebrow">Post Orbit</p> */}
            <h1 className="mt-3 max-w-lg text-[2.6rem] leading-[1.05] text-forest-900 sm:text-6xl">
              Write once
            </h1>
            <h1 className="mt-3 max-w-lg text-[2.6rem] leading-[1.05] text-forest-900 sm:text-6xl">
              Post everywhere
            </h1>
            <h1 className="mt-3 max-w-lg text-[2.6rem] leading-[1.05] text-forest-900 sm:text-6xl">
              Repeat
            </h1>
            <p className="mt-5 max-w-md text-[1rem] leading-7 text-forest-800">
              A rich text editor with an AI writing helper, media uploads, and
              recurring posts. Works through your Buffer account.
            </p>
            <div className="mt-8 max-w-xs">
              <ContinueButton className="w-full px-6 py-3.5 text-base" />
              {/* <p className="mt-3 text-xs leading-5 text-forest-800">
                You sign in on Buffer. We never see your Buffer password.
              </p> */}
            </div>
          </div>
          <div className="grid place-items-center bg-mist-300 p-8 md:col-span-2">
            <div className="w-full max-w-60 space-y-3">
              {["Rich text", "AI helper", "Recurring"].map((t, i) => (
                <div
                  key={t}
                  className="rounded-2xl bg-white/90 p-4 shadow-sm"
                  style={{ marginLeft: i * 14 }}
                >
                  <div className="text-xs font-semibold text-forest-800">
                    {t}
                  </div>
                  <div className="mt-2 h-2 w-4/5 rounded-full bg-mist-200" />
                  <div className="mt-1.5 h-2 w-3/5 rounded-full bg-mist-200" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
