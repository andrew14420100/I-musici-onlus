#!/usr/bin/env python3
"""
Backend API Testing for Accademia de 'I Musici'
Tests all backend endpoints with admin authentication
"""

import requests
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import uuid

# Configuration
BASE_URL = "https://musici-academy.preview.emergentagent.com/api"
ADMIN_TOKEN = "test_session_admin_1767808667676"
HEADERS = {
    "Authorization": f"Bearer {ADMIN_TOKEN}",
    "Content-Type": "application/json"
}

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS
        self.test_results = []
        self.created_resources = {
            "users": [],
            "courses": [],
            "lessons": [],
            "payments": [],
            "notifications": []
        }
    
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 400
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
        except requests.exceptions.RequestException as e:
            return False, str(e), 0
    
    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("=== TESTING AUTHENTICATION ENDPOINTS ===")
        
        # Test GET /api/auth/me
        success, data, status = self.make_request("GET", "/auth/me")
        if success and isinstance(data, dict) and "user_id" in data:
            self.log_test("GET /auth/me", True, f"User authenticated: {data.get('name', 'Unknown')}")
        else:
            self.log_test("GET /auth/me", False, f"Auth failed - Status: {status}", data)
        
        # Test POST /api/auth/logout (non-destructive, just test endpoint exists)
        # We won't actually logout as it would invalidate our token
        print("Note: Skipping actual logout to preserve session for other tests")
    
    def test_users_endpoints(self):
        """Test users CRUD endpoints"""
        print("=== TESTING USERS ENDPOINTS ===")
        
        # Test GET /api/users
        success, data, status = self.make_request("GET", "/users")
        if success and isinstance(data, list):
            self.log_test("GET /users", True, f"Retrieved {len(data)} users")
        else:
            self.log_test("GET /users", False, f"Failed to get users - Status: {status}", data)
        
        # Test GET /api/users with filters
        success, data, status = self.make_request("GET", "/users", params={"role": "studente"})
        if success:
            self.log_test("GET /users?role=studente", True, f"Retrieved {len(data)} students")
        else:
            self.log_test("GET /users?role=studente", False, f"Filter failed - Status: {status}", data)
        
        # Test POST /api/users - Create new user
        new_user_data = {
            "email": f"test.user.{uuid.uuid4().hex[:8]}@musici.it",
            "name": "Test User API",
            "phone": "+39 333 9999999",
            "role": "studente"
        }
        success, data, status = self.make_request("POST", "/users", new_user_data)
        if success and isinstance(data, dict) and "user_id" in data:
            user_id = data["user_id"]
            self.created_resources["users"].append(user_id)
            self.log_test("POST /users", True, f"Created user: {user_id}")
            
            # Test GET /api/users/{user_id}
            success, data, status = self.make_request("GET", f"/users/{user_id}")
            if success:
                self.log_test(f"GET /users/{user_id}", True, "Retrieved specific user")
            else:
                self.log_test(f"GET /users/{user_id}", False, f"Failed - Status: {status}", data)
            
            # Test PUT /api/users/{user_id}
            update_data = {"name": "Updated Test User", "phone": "+39 333 8888888"}
            success, data, status = self.make_request("PUT", f"/users/{user_id}", update_data)
            if success:
                self.log_test(f"PUT /users/{user_id}", True, "Updated user successfully")
            else:
                self.log_test(f"PUT /users/{user_id}", False, f"Update failed - Status: {status}", data)
        else:
            self.log_test("POST /users", False, f"User creation failed - Status: {status}", data)
    
    def test_courses_endpoints(self):
        """Test courses CRUD endpoints"""
        print("=== TESTING COURSES ENDPOINTS ===")
        
        # Test GET /api/courses
        success, data, status = self.make_request("GET", "/courses")
        if success and isinstance(data, list):
            self.log_test("GET /courses", True, f"Retrieved {len(data)} courses")
        else:
            self.log_test("GET /courses", False, f"Failed to get courses - Status: {status}", data)
        
        # Test GET /api/courses with filters
        success, data, status = self.make_request("GET", "/courses", params={"instrument": "Pianoforte"})
        if success:
            self.log_test("GET /courses?instrument=Pianoforte", True, f"Retrieved {len(data)} piano courses")
        else:
            self.log_test("GET /courses?instrument=Pianoforte", False, f"Filter failed - Status: {status}", data)
        
        # Test POST /api/courses - Create new course
        new_course_data = {
            "name": "Test Course API",
            "instrument": "Flauto",
            "description": "Test course created by API testing"
        }
        success, data, status = self.make_request("POST", "/courses", new_course_data)
        if success and isinstance(data, dict) and "course_id" in data:
            course_id = data["course_id"]
            self.created_resources["courses"].append(course_id)
            self.log_test("POST /courses", True, f"Created course: {course_id}")
            
            # Test GET /api/courses/{course_id}
            success, data, status = self.make_request("GET", f"/courses/{course_id}")
            if success:
                self.log_test(f"GET /courses/{course_id}", True, "Retrieved specific course")
            else:
                self.log_test(f"GET /courses/{course_id}", False, f"Failed - Status: {status}", data)
            
            # Test PUT /api/courses/{course_id}
            update_data = {"description": "Updated test course description"}
            success, data, status = self.make_request("PUT", f"/courses/{course_id}", update_data)
            if success:
                self.log_test(f"PUT /courses/{course_id}", True, "Updated course successfully")
            else:
                self.log_test(f"PUT /courses/{course_id}", False, f"Update failed - Status: {status}", data)
            
            # Test teacher assignment (need to get a teacher first)
            success, users_data, status = self.make_request("GET", "/users", params={"role": "insegnante"})
            if success and users_data:
                teacher_id = users_data[0]["user_id"]
                success, data, status = self.make_request("POST", f"/courses/{course_id}/teachers/{teacher_id}")
                if success:
                    self.log_test(f"POST /courses/{course_id}/teachers/{teacher_id}", True, "Assigned teacher to course")
                    
                    # Test teacher removal
                    success, data, status = self.make_request("DELETE", f"/courses/{course_id}/teachers/{teacher_id}")
                    if success:
                        self.log_test(f"DELETE /courses/{course_id}/teachers/{teacher_id}", True, "Removed teacher from course")
                    else:
                        self.log_test(f"DELETE /courses/{course_id}/teachers/{teacher_id}", False, f"Failed - Status: {status}", data)
                else:
                    self.log_test(f"POST /courses/{course_id}/teachers/{teacher_id}", False, f"Failed - Status: {status}", data)
            
            # Test student enrollment
            success, users_data, status = self.make_request("GET", "/users", params={"role": "studente"})
            if success and users_data:
                student_id = users_data[0]["user_id"]
                success, data, status = self.make_request("POST", f"/courses/{course_id}/students/{student_id}")
                if success:
                    self.log_test(f"POST /courses/{course_id}/students/{student_id}", True, "Enrolled student in course")
                    
                    # Test student removal
                    success, data, status = self.make_request("DELETE", f"/courses/{course_id}/students/{student_id}")
                    if success:
                        self.log_test(f"DELETE /courses/{course_id}/students/{student_id}", True, "Removed student from course")
                    else:
                        self.log_test(f"DELETE /courses/{course_id}/students/{student_id}", False, f"Failed - Status: {status}", data)
                else:
                    self.log_test(f"POST /courses/{course_id}/students/{student_id}", False, f"Failed - Status: {status}", data)
        else:
            self.log_test("POST /courses", False, f"Course creation failed - Status: {status}", data)
    
    def test_lessons_endpoints(self):
        """Test lessons CRUD endpoints"""
        print("=== TESTING LESSONS ENDPOINTS ===")
        
        # Test GET /api/lessons
        success, data, status = self.make_request("GET", "/lessons")
        if success and isinstance(data, list):
            self.log_test("GET /lessons", True, f"Retrieved {len(data)} lessons")
        else:
            self.log_test("GET /lessons", False, f"Failed to get lessons - Status: {status}", data)
        
        # Test GET /api/lessons with filters
        success, data, status = self.make_request("GET", "/lessons", params={"status": "programmata"})
        if success:
            self.log_test("GET /lessons?status=programmata", True, f"Retrieved {len(data)} scheduled lessons")
        else:
            self.log_test("GET /lessons?status=programmata", False, f"Filter failed - Status: {status}", data)
        
        # Get required data for lesson creation
        success, courses_data, status = self.make_request("GET", "/courses")
        success2, teachers_data, status2 = self.make_request("GET", "/users", params={"role": "insegnante"})
        success3, students_data, status3 = self.make_request("GET", "/users", params={"role": "studente"})
        
        if success and success2 and success3 and courses_data and teachers_data and students_data:
            # Test POST /api/lessons - Create new lesson
            lesson_date = datetime.now(timezone.utc) + timedelta(days=1)
            new_lesson_data = {
                "course_id": courses_data[0]["course_id"],
                "teacher_id": teachers_data[0]["user_id"],
                "student_id": students_data[0]["user_id"],
                "date_time": lesson_date.isoformat(),
                "duration_minutes": 60,
                "notes": "Test lesson created by API testing"
            }
            success, data, status = self.make_request("POST", "/lessons", new_lesson_data)
            if success and isinstance(data, dict) and "lesson_id" in data:
                lesson_id = data["lesson_id"]
                self.created_resources["lessons"].append(lesson_id)
                self.log_test("POST /lessons", True, f"Created lesson: {lesson_id}")
                
                # Test GET /api/lessons/{lesson_id}
                success, data, status = self.make_request("GET", f"/lessons/{lesson_id}")
                if success:
                    self.log_test(f"GET /lessons/{lesson_id}", True, "Retrieved specific lesson")
                else:
                    self.log_test(f"GET /lessons/{lesson_id}", False, f"Failed - Status: {status}", data)
                
                # Test PUT /api/lessons/{lesson_id}
                update_data = {"notes": "Updated test lesson notes", "status": "completata"}
                success, data, status = self.make_request("PUT", f"/lessons/{lesson_id}", update_data)
                if success:
                    self.log_test(f"PUT /lessons/{lesson_id}", True, "Updated lesson successfully")
                else:
                    self.log_test(f"PUT /lessons/{lesson_id}", False, f"Update failed - Status: {status}", data)
            else:
                self.log_test("POST /lessons", False, f"Lesson creation failed - Status: {status}", data)
        else:
            self.log_test("POST /lessons", False, "Cannot create lesson - missing required data (courses/teachers/students)")
    
    def test_payments_endpoints(self):
        """Test payments CRUD endpoints"""
        print("=== TESTING PAYMENTS ENDPOINTS ===")
        
        # Test GET /api/payments
        success, data, status = self.make_request("GET", "/payments")
        if success and isinstance(data, list):
            self.log_test("GET /payments", True, f"Retrieved {len(data)} payments")
        else:
            self.log_test("GET /payments", False, f"Failed to get payments - Status: {status}", data)
        
        # Test GET /api/payments with filters
        success, data, status = self.make_request("GET", "/payments", params={"payment_type": "quota_studente"})
        if success:
            self.log_test("GET /payments?payment_type=quota_studente", True, f"Retrieved {len(data)} student fee payments")
        else:
            self.log_test("GET /payments?payment_type=quota_studente", False, f"Filter failed - Status: {status}", data)
        
        # Get a user for payment creation
        success, users_data, status = self.make_request("GET", "/users", params={"role": "studente"})
        if success and users_data:
            # Test POST /api/payments - Create new payment
            due_date = datetime.now(timezone.utc) + timedelta(days=30)
            new_payment_data = {
                "user_id": users_data[0]["user_id"],
                "payment_type": "quota_studente",
                "amount": 175.0,
                "description": "Test payment created by API testing",
                "due_date": due_date.isoformat()
            }
            success, data, status = self.make_request("POST", "/payments", new_payment_data)
            if success and isinstance(data, dict) and "payment_id" in data:
                payment_id = data["payment_id"]
                self.created_resources["payments"].append(payment_id)
                self.log_test("POST /payments", True, f"Created payment: {payment_id}")
                
                # Test GET /api/payments/{payment_id}
                success, data, status = self.make_request("GET", f"/payments/{payment_id}")
                if success:
                    self.log_test(f"GET /payments/{payment_id}", True, "Retrieved specific payment")
                else:
                    self.log_test(f"GET /payments/{payment_id}", False, f"Failed - Status: {status}", data)
                
                # Test PUT /api/payments/{payment_id}
                update_data = {"status": "pagato", "amount": 180.0}
                success, data, status = self.make_request("PUT", f"/payments/{payment_id}", update_data)
                if success:
                    self.log_test(f"PUT /payments/{payment_id}", True, "Updated payment successfully")
                else:
                    self.log_test(f"PUT /payments/{payment_id}", False, f"Update failed - Status: {status}", data)
            else:
                self.log_test("POST /payments", False, f"Payment creation failed - Status: {status}", data)
        else:
            self.log_test("POST /payments", False, "Cannot create payment - no users found")
    
    def test_notifications_endpoints(self):
        """Test notifications CRUD endpoints"""
        print("=== TESTING NOTIFICATIONS ENDPOINTS ===")
        
        # Test GET /api/notifications
        success, data, status = self.make_request("GET", "/notifications")
        if success and isinstance(data, list):
            self.log_test("GET /notifications", True, f"Retrieved {len(data)} notifications")
        else:
            self.log_test("GET /notifications", False, f"Failed to get notifications - Status: {status}", data)
        
        # Test POST /api/notifications - Create new notification
        new_notification_data = {
            "title": "Test Notification API",
            "message": "This is a test notification created by API testing",
            "notification_type": "generale",
            "recipient_ids": []
        }
        success, data, status = self.make_request("POST", "/notifications", new_notification_data)
        if success and isinstance(data, dict) and "notification_id" in data:
            notification_id = data["notification_id"]
            self.created_resources["notifications"].append(notification_id)
            self.log_test("POST /notifications", True, f"Created notification: {notification_id}")
            
            # Test PUT /api/notifications/{notification_id}
            update_data = {"title": "Updated Test Notification", "is_active": False}
            success, data, status = self.make_request("PUT", f"/notifications/{notification_id}", update_data)
            if success:
                self.log_test(f"PUT /notifications/{notification_id}", True, "Updated notification successfully")
            else:
                self.log_test(f"PUT /notifications/{notification_id}", False, f"Update failed - Status: {status}", data)
        else:
            self.log_test("POST /notifications", False, f"Notification creation failed - Status: {status}", data)
    
    def test_stats_endpoints(self):
        """Test admin stats endpoints"""
        print("=== TESTING STATS ENDPOINTS ===")
        
        # Test GET /api/stats/admin
        success, data, status = self.make_request("GET", "/stats/admin")
        if success and isinstance(data, dict):
            expected_keys = ["studenti_attivi", "insegnanti_attivi", "corsi_attivi", "lezioni_settimana"]
            if all(key in data for key in expected_keys):
                self.log_test("GET /stats/admin", True, f"Retrieved admin stats with all expected fields")
            else:
                self.log_test("GET /stats/admin", False, f"Missing expected fields in stats response", data)
        else:
            self.log_test("GET /stats/admin", False, f"Failed to get admin stats - Status: {status}", data)
    
    def cleanup_test_data(self):
        """Clean up created test data"""
        print("=== CLEANING UP TEST DATA ===")
        
        # Delete created resources in reverse order
        for notification_id in self.created_resources["notifications"]:
            success, _, _ = self.make_request("DELETE", f"/notifications/{notification_id}")
            if success:
                print(f"✅ Deleted notification: {notification_id}")
            else:
                print(f"❌ Failed to delete notification: {notification_id}")
        
        for payment_id in self.created_resources["payments"]:
            success, _, _ = self.make_request("DELETE", f"/payments/{payment_id}")
            if success:
                print(f"✅ Deleted payment: {payment_id}")
            else:
                print(f"❌ Failed to delete payment: {payment_id}")
        
        for lesson_id in self.created_resources["lessons"]:
            success, _, _ = self.make_request("DELETE", f"/lessons/{lesson_id}")
            if success:
                print(f"✅ Deleted lesson: {lesson_id}")
            else:
                print(f"❌ Failed to delete lesson: {lesson_id}")
        
        for course_id in self.created_resources["courses"]:
            success, _, _ = self.make_request("DELETE", f"/courses/{course_id}")
            if success:
                print(f"✅ Deleted course: {course_id}")
            else:
                print(f"❌ Failed to delete course: {course_id}")
        
        for user_id in self.created_resources["users"]:
            success, _, _ = self.make_request("DELETE", f"/users/{user_id}")
            if success:
                print(f"✅ Deleted user: {user_id}")
            else:
                print(f"❌ Failed to delete user: {user_id}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"Starting API tests for: {self.base_url}")
        print(f"Using admin token: {ADMIN_TOKEN[:20]}...")
        print("=" * 60)
        
        self.test_auth_endpoints()
        self.test_users_endpoints()
        self.test_courses_endpoints()
        self.test_lessons_endpoints()
        self.test_payments_endpoints()
        self.test_notifications_endpoints()
        self.test_stats_endpoints()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests, self.test_results

if __name__ == "__main__":
    tester = APITester()
    passed, failed, results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    exit(0 if failed == 0 else 1)