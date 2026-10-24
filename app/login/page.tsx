import { redirect } from "next/navigation";

// Demo mode has no login: old links land on the role picker.
export default function Login() {
  redirect("/");
}
