import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";
import { vi } from "vitest";

describe("LoginForm", () => {
  it("renders login form with title", () => {
    const mockLogin = async () => {};
    render(<LoginForm onLogin={mockLogin} />);

    expect(screen.getByText("Kanban")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
  });

  it("renders username input", () => {
    const mockLogin = async () => {};
    render(<LoginForm onLogin={mockLogin} />);

    const input = screen.getByLabelText("Username");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders password input", () => {
    const mockLogin = async () => {};
    render(<LoginForm onLogin={mockLogin} />);

    const input = screen.getByLabelText("Password");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("renders submit button", () => {
    const mockLogin = async () => {};
    render(<LoginForm onLogin={mockLogin} />);

    const button = screen.getByLabelText("Sign in");
    expect(button).toBeInTheDocument();
  });

  it("calls onLogin with credentials on form submit", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={mockLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByLabelText("Sign in");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpass");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
    });
  });

  it("shows loading state", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(<LoginForm onLogin={mockLogin} isLoading={true} />);

    const submitButton = screen.getByLabelText("Sign in") as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Signing in...");
  });

  it("displays error message", () => {
    const mockLogin = async () => {};
    render(
      <LoginForm
        onLogin={mockLogin}
        error="Invalid credentials"
      />
    );

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("displays demo credentials help", () => {
    const mockLogin = async () => {};
    render(<LoginForm onLogin={mockLogin} />);

    expect(screen.getByText("Demo credentials:")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("password")).toBeInTheDocument();
  });

  it("trims whitespace from inputs", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={mockLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByLabelText("Sign in");

    await user.type(usernameInput, "  testuser  ");
    await user.type(passwordInput, "  testpass  ");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
    });
  });

  it("requires non-empty input", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    render(<LoginForm onLogin={mockLogin} />);

    const submitButton = screen.getByLabelText("Sign in");

    // Try submitting empty form
    await user.click(submitButton);

    // onLogin should not be called
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
